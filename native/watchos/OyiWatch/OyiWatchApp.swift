import SwiftUI

@main
struct OyiWatchApp: App {
    @StateObject private var session = OyiWatchSession()

    var body: some Scene {
        WindowGroup {
            OyiWatchRootView()
                .environmentObject(session)
        }
    }
}

enum OyiWatchState: String, CaseIterable {
    case awareness
    case listening
    case thinking
    case executing
    case confirmationRequired
    case success
    case alert
    case failed
}

struct OyiGlance: Identifiable, Decodable {
    let id: String
    let type: String
    let title: String
    let detail: String
    let state: String?
}

struct OyiQuickAction: Identifiable, Decodable {
    let id: String
    let label: String
    let prompt: String
    let risk: String
    let enabled: Bool
    let confirmation_required: Bool?
}

struct OyiWatchCommandResponse: Decodable {
    let state: String
    let reply: String
    let confirmations: [OyiConfirmation]?
}

struct OyiConfirmation: Decodable, Identifiable {
    let tool_id: String?
    let status: String?
    let ledger_id: String?
    var id: String { ledger_id ?? UUID().uuidString }
}

final class OyiWatchSession: ObservableObject {
    @Published var state: OyiWatchState = .awareness
    @Published var title: String = "Home calm"
    @Published var detail: String = "All systems normal"
    @Published var glances: [OyiGlance] = []
    @Published var actions: [OyiQuickAction] = []
    @Published var pendingConfirmation: OyiConfirmation?

    // The iOS companion should inject these through WatchConnectivity after login.
    var baseURL: URL?
    var bearerToken: String?

    func refresh() async {
        await fetchStatus()
        await fetchGlances()
        await fetchActions()
    }

    @MainActor
    func setListening() {
        state = .listening
        title = "Listening..."
        detail = "Speak naturally"
    }

    func run(command: String) async {
        await MainActor.run {
            state = .thinking
            title = "Working"
            detail = "Preparing..."
        }
        do {
            let response: OyiWatchCommandResponse = try await request("/watch/command", method: "POST", body: ["command": command])
            await apply(response)
        } catch {
            await MainActor.run {
                state = .failed
                title = "Not completed"
                detail = "Try again"
            }
        }
    }

    func run(action: OyiQuickAction) async {
        await MainActor.run {
            state = .thinking
            title = action.label
            detail = "Preparing..."
        }
        do {
            let response: OyiWatchCommandResponse = try await request("/watch/command", method: "POST", body: ["action_id": action.id])
            await apply(response)
        } catch {
            await MainActor.run {
                state = .failed
                title = "Not completed"
                detail = "Try again"
            }
        }
    }

    func confirm() async {
        guard let pendingConfirmation else { return }
        await MainActor.run {
            state = .executing
            title = "Working"
            detail = "Executing..."
        }
        do {
            let response: OyiWatchCommandResponse = try await request("/watch/confirm", method: "POST", body: ["ledger_id": pendingConfirmation.id])
            await apply(response)
        } catch {
            await MainActor.run {
                state = .failed
                title = "Not completed"
                detail = "Try again"
            }
        }
    }

    func cancel() async {
        guard let pendingConfirmation else { return }
        _ = try? await requestRaw("/watch/cancel", method: "POST", body: ["ledger_id": pendingConfirmation.id])
        await MainActor.run {
            self.pendingConfirmation = nil
            state = .awareness
            title = "Cancelled"
            detail = "No action taken"
        }
    }

    private func apply(_ response: OyiWatchCommandResponse) async {
        await MainActor.run {
            detail = response.reply
            if response.state == "confirmation_required", let confirmation = response.confirmations?.first {
                state = .confirmationRequired
                title = "Confirm?"
                pendingConfirmation = confirmation
            } else if response.state == "success" {
                state = .success
                title = "Done"
                pendingConfirmation = nil
            } else if response.state == "denied" {
                state = .failed
                title = "Not allowed"
                pendingConfirmation = nil
            } else if response.state == "failed" {
                state = .failed
                title = "Not completed"
                pendingConfirmation = nil
            } else {
                state = .executing
                title = "Queued"
            }
        }
    }

    private func fetchStatus() async {
        do {
            let payload: [String: AnyDecodable] = try await request("/watch/home-status")
            await MainActor.run {
                title = payload["title"]?.stringValue ?? title
                detail = payload["summary"]?.stringValue ?? detail
            }
        } catch {}
    }

    private func fetchGlances() async {
        do {
            let payload: GlancePayload = try await request("/watch/glances")
            await MainActor.run { glances = payload.items }
        } catch {}
    }

    private func fetchActions() async {
        do {
            let payload: ActionPayload = try await request("/watch/quick-actions")
            await MainActor.run { actions = payload.actions }
        } catch {}
    }

    private func request<T: Decodable>(_ path: String, method: String = "GET", body: [String: String]? = nil) async throws -> T {
        let data = try await requestRaw(path, method: method, body: body)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func requestRaw(_ path: String, method: String = "GET", body: [String: String]? = nil) async throws -> Data {
        guard let baseURL, let bearerToken else { throw URLError(.userAuthenticationRequired) }
        var request = URLRequest(url: baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))))
        request.httpMethod = method
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("watchos", forHTTPHeaderField: "x-ochiga-surface")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw URLError(.badServerResponse) }
        return data
    }
}

struct GlancePayload: Decodable { let items: [OyiGlance] }
struct ActionPayload: Decodable { let actions: [OyiQuickAction] }

struct AnyDecodable: Decodable {
    let value: Any
    var stringValue: String? { value as? String }
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) { self.value = value }
        else if let value = try? container.decode(Int.self) { self.value = value }
        else if let value = try? container.decode(Bool.self) { self.value = value }
        else { self.value = "" }
    }
}

struct OyiWatchRootView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        TabView {
            AwarenessView()
            QuickActionsView()
            ConfirmationView()
        }
        .tabViewStyle(.verticalPage)
        .task { await session.refresh() }
    }
}

struct AwarenessView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        VStack(spacing: 10) {
            OyiOrb(state: session.state)
            Text(session.title).font(.headline).foregroundStyle(.white)
            Text(session.detail).font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .containerBackground(.black.gradient, for: .navigation)
    }
}

struct QuickActionsView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(session.actions) { action in
                    Button(action.label) { Task { await session.run(action: action) } }
                        .buttonStyle(.borderedProminent)
                        .disabled(!action.enabled)
                }
            }
        }
    }
}

struct ConfirmationView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        VStack(spacing: 10) {
            OyiOrb(state: .confirmationRequired)
            Text(session.pendingConfirmation == nil ? "No confirmation" : "Confirm action?")
                .font(.headline)
            HStack {
                Button("Cancel") { Task { await session.cancel() } }.tint(.gray)
                Button("Confirm") { Task { await session.confirm() } }.tint(.blue)
            }
            .disabled(session.pendingConfirmation == nil)
        }
    }
}

struct OyiOrb: View {
    let state: OyiWatchState

    var body: some View {
        Circle()
            .fill(.radialGradient(colors: colors, center: .center, startRadius: 4, endRadius: 58))
            .frame(width: 86, height: 86)
            .overlay(Circle().stroke(.white.opacity(0.16), lineWidth: 1))
            .shadow(color: colors.first?.opacity(0.38) ?? .blue.opacity(0.3), radius: 18)
    }

    var colors: [Color] {
        switch state {
        case .alert, .failed: return [.red.opacity(0.8), .black]
        case .success: return [.green.opacity(0.8), .black]
        case .confirmationRequired: return [.orange.opacity(0.8), .black]
        case .executing, .thinking: return [.blue.opacity(0.9), .black]
        default: return [.cyan.opacity(0.75), .black]
        }
    }
}
