import SwiftUI
import Foundation
import Security
import WatchConnectivity

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

struct GlancePayload: Decodable { let items: [OyiGlance] }
struct ActionPayload: Decodable { let actions: [OyiQuickAction] }

struct AnyDecodable: Decodable {
    let value: Any
    var stringValue: String? { value as? String }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) { self.value = value }
        else if let value = try? container.decode(Int.self) { self.value = String(value) }
        else if let value = try? container.decode(Bool.self) { self.value = value ? "true" : "false" }
        else { self.value = "" }
    }
}

final class OyiWatchSession: ObservableObject {
    @Published var state: OyiWatchState = .awareness
    @Published var title: String = "Home calm"
    @Published var detail: String = "All systems normal"
    @Published var glances: [OyiGlance] = OyiWatchSession.mockGlances
    @Published var actions: [OyiQuickAction] = OyiWatchSession.mockActions
    @Published var pendingConfirmation: OyiConfirmation?
    @Published var activePage: Int = 0
    @Published var isMockMode: Bool = true
    @Published var connectionLabel: String = "Mock mode"

    private let keychain = OyiWatchKeychain()
    private lazy var connectivity = OyiWatchConnectivityBridge(session: self)

    private var baseURL: URL?
    private var bearerToken: String?

    init() {
        loadConfiguration()
        connectivity.activate()
    }

    func refresh() async {
        loadConfiguration()
        guard hasBackendConfiguration else {
            await applyMockHome()
            return
        }
        await fetchStatus()
        await fetchGlances()
        await fetchActions()
    }

    @MainActor
    func setListening() {
        state = .listening
        title = "Listening..."
        detail = "Speak naturally"
        activePage = 0
    }

    func simulateVoiceCommand(_ command: String = "show home status") async {
        await MainActor.run {
            setListening()
        }
        try? await Task.sleep(nanoseconds: 550_000_000)
        await run(command: command)
    }

    func openQuickActions() {
        activePage = 1
        state = .awareness
        title = "Quick actions"
        detail = "Choose one action"
    }

    func showAlertDemo() {
        activePage = 0
        state = .alert
        title = "Visitor at gate"
        detail = "Front gate is waiting"
    }

    func run(command: String) async {
        await MainActor.run {
            state = .thinking
            title = "Working"
            detail = "Preparing..."
            activePage = 0
        }
        guard hasBackendConfiguration else {
            await mockRun(command: command)
            return
        }
        do {
            let response: OyiWatchCommandResponse = try await request("/watch/command", method: "POST", body: ["command": command])
            await apply(response)
        } catch {
            await fallbackFailure(error)
        }
    }

    func run(action: OyiQuickAction) async {
        await MainActor.run {
            state = .thinking
            title = action.label
            detail = "Preparing..."
            activePage = 0
        }
        guard action.enabled else {
            await MainActor.run {
                state = .failed
                title = "Not allowed"
                detail = "Permission required"
            }
            return
        }
        guard hasBackendConfiguration else {
            await mockRun(action: action)
            return
        }
        do {
            let response: OyiWatchCommandResponse = try await request("/watch/command", method: "POST", body: ["action_id": action.id])
            await apply(response)
        } catch {
            await fallbackFailure(error)
        }
    }

    func confirm() async {
        guard let pendingConfirmation else {
            await MainActor.run {
                state = .awareness
                title = "No confirmation"
                detail = "Nothing is pending"
                activePage = 2
            }
            return
        }
        await MainActor.run {
            state = .executing
            title = "Working"
            detail = "Executing..."
            activePage = 0
        }
        guard hasBackendConfiguration else {
            try? await Task.sleep(nanoseconds: 650_000_000)
            await MainActor.run {
                self.pendingConfirmation = nil
                state = .success
                title = "Done"
                detail = "Action completed"
            }
            return
        }
        do {
            let response: OyiWatchCommandResponse = try await request("/watch/confirm", method: "POST", body: ["ledger_id": pendingConfirmation.id])
            await apply(response)
        } catch {
            await fallbackFailure(error)
        }
    }

    func cancel() async {
        guard let pendingConfirmation else {
            await MainActor.run {
                state = .awareness
                title = "Home calm"
                detail = "No action pending"
                activePage = 0
            }
            return
        }
        if hasBackendConfiguration {
            _ = try? await requestRaw("/watch/cancel", method: "POST", body: ["ledger_id": pendingConfirmation.id])
        }
        await MainActor.run {
            self.pendingConfirmation = nil
            state = .awareness
            title = "Cancelled"
            detail = "No action taken"
            activePage = 0
        }
    }

    func applyCompanionPayload(_ payload: [String: Any]) async {
        var didUpdate = false
        if let urlString = payload["baseURL"] as? String ?? payload["backendBaseURL"] as? String,
           let url = URL(string: urlString) {
            baseURL = url
            keychain.save(urlString, account: "backendBaseURL")
            didUpdate = true
        }
        if let token = payload["bearerToken"] as? String ?? payload["authToken"] as? String, !token.isEmpty {
            bearerToken = token
            keychain.save(token, account: "bearerToken")
            didUpdate = true
        }
        await MainActor.run {
            isMockMode = !hasBackendConfiguration
            connectionLabel = hasBackendConfiguration ? "Connected" : "Mock mode"
            if didUpdate {
                title = "Watch linked"
                detail = "Session received"
                state = .success
            }
        }
        if didUpdate { await refresh() }
    }

    private var hasBackendConfiguration: Bool {
        baseURL != nil && bearerToken?.isEmpty == false
    }

    private func loadConfiguration() {
        let environment = ProcessInfo.processInfo.environment
        let envURL = environment["OYI_WATCH_BACKEND_URL"].flatMap(URL.init(string:))
        let envToken = environment["OYI_WATCH_DEV_TOKEN"]
        baseURL = envURL ?? keychain.read(account: "backendBaseURL").flatMap(URL.init(string:))
        bearerToken = envToken ?? keychain.read(account: "bearerToken")
        DispatchQueue.main.async {
            self.isMockMode = !self.hasBackendConfiguration
            self.connectionLabel = self.hasBackendConfiguration ? "Connected" : "Mock mode"
        }
    }

    private func apply(_ response: OyiWatchCommandResponse) async {
        await MainActor.run {
            detail = response.reply
            activePage = 0
            if response.state == "confirmation_required", let confirmation = response.confirmations?.first {
                state = .confirmationRequired
                title = "Confirm?"
                pendingConfirmation = confirmation
                activePage = 2
            } else if response.state == "success" || response.state == "executed" {
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
                state = payload["state"]?.stringValue == "attention" ? .alert : .awareness
            }
        } catch { await applyMockHome() }
    }

    private func fetchGlances() async {
        do {
            let payload: GlancePayload = try await request("/watch/glances")
            await MainActor.run { glances = payload.items.isEmpty ? Self.mockGlances : payload.items }
        } catch {
            await MainActor.run { glances = Self.mockGlances }
        }
    }

    private func fetchActions() async {
        do {
            let payload: ActionPayload = try await request("/watch/quick-actions")
            await MainActor.run { actions = payload.actions.isEmpty ? Self.mockActions : payload.actions }
        } catch {
            await MainActor.run { actions = Self.mockActions }
        }
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

    private func fallbackFailure(_ error: Error) async {
        await MainActor.run {
            state = .failed
            title = "Not completed"
            detail = error.localizedDescription.isEmpty ? "Try again" : "Backend unavailable"
            pendingConfirmation = nil
        }
    }

    private func applyMockHome() async {
        await MainActor.run {
            isMockMode = true
            connectionLabel = "Mock mode"
            title = "Home calm"
            detail = "Simulator ready"
            glances = Self.mockGlances
            actions = Self.mockActions
        }
    }

    private func mockRun(command: String) async {
        try? await Task.sleep(nanoseconds: 650_000_000)
        let lower = command.lowercased()
        if lower.contains("gate") || lower.contains("lock") || lower.contains("security") {
            await MainActor.run {
                pendingConfirmation = OyiConfirmation(tool_id: "mock_confirm", status: "pending_confirmation", ledger_id: "mock-ledger")
                state = .confirmationRequired
                title = "Confirm?"
                detail = lower.contains("gate") ? "Open gate?" : "Run secure action?"
                activePage = 2
            }
        } else {
            await MainActor.run {
                state = .success
                title = "Done"
                detail = lower.contains("light") ? "Lights updated" : "Status checked"
                pendingConfirmation = nil
            }
        }
    }

    private func mockRun(action: OyiQuickAction) async {
        if action.confirmation_required == true || action.risk == "medium" {
            try? await Task.sleep(nanoseconds: 350_000_000)
            await MainActor.run {
                pendingConfirmation = OyiConfirmation(tool_id: action.id, status: "pending_confirmation", ledger_id: "mock-\(action.id)")
                state = .confirmationRequired
                title = "Confirm?"
                detail = "\(action.label)?"
                activePage = 2
            }
            return
        }
        try? await Task.sleep(nanoseconds: 650_000_000)
        await MainActor.run {
            state = .success
            title = "Done"
            detail = "\(action.label) completed"
            pendingConfirmation = nil
        }
    }

    static let mockGlances: [OyiGlance] = [
        OyiGlance(id: "home", type: "awareness", title: "Home calm", detail: "All systems normal", state: "calm"),
        OyiGlance(id: "visitor", type: "visitor", title: "Visitor at gate", detail: "Front gate", state: "unread"),
        OyiGlance(id: "climate", type: "climate", title: "Living room", detail: "24° · Cool", state: "online")
    ]

    static let mockActions: [OyiQuickAction] = [
        OyiQuickAction(id: "show_status", label: "Home status", prompt: "show home status", risk: "read", enabled: true, confirmation_required: false),
        OyiQuickAction(id: "all_lights_off", label: "Lights off", prompt: "turn off lights", risk: "low", enabled: true, confirmation_required: false),
        OyiQuickAction(id: "movie_mode", label: "Movie mode", prompt: "activate movie mode", risk: "low", enabled: true, confirmation_required: false),
        OyiQuickAction(id: "arm_security", label: "Arm security", prompt: "arm security", risk: "medium", enabled: true, confirmation_required: true)
    ]
}

final class OyiWatchConnectivityBridge: NSObject, WCSessionDelegate {
    private weak var sessionModel: OyiWatchSession?

    init(session: OyiWatchSession) {
        self.sessionModel = session
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        Task { await sessionModel?.applyCompanionPayload(applicationContext) }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        Task { await sessionModel?.applyCompanionPayload(message) }
    }
}

struct OyiWatchKeychain {
    private let service = "com.ochiga.oyios.watch.session"

    func save(_ value: String, account: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        SecItemAdd(attributes as CFDictionary, nil)
    }

    func read(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

struct OyiWatchRootView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        TabView(selection: $session.activePage) {
            AwarenessView().tag(0)
            QuickActionsView().tag(1)
            ConfirmationView().tag(2)
        }
        .tabViewStyle(.verticalPage)
        .task { await session.refresh() }
    }
}

struct AwarenessView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text(session.connectionLabel)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(session.isMockMode ? .orange : .green)
                Spacer()
                Button("More") { session.openQuickActions() }
                    .font(.system(size: 10, weight: .semibold))
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
            }
            OyiOrb(state: session.state)
            Text(session.title).font(.headline).foregroundStyle(.white).lineLimit(1)
            Text(session.detail).font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center).lineLimit(2)
            HStack(spacing: 6) {
                Button("Talk") { Task { await session.simulateVoiceCommand("show home status") } }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                Button("Alert") { session.showAlertDemo() }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
            }
        }
        .padding(.horizontal, 4)
        .containerBackground(.black.gradient, for: .navigation)
    }
}

struct QuickActionsView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Quick actions")
                    .font(.headline)
                    .foregroundStyle(.white)
                ForEach(session.actions) { action in
                    Button {
                        Task { await session.run(action: action) }
                    } label: {
                        HStack {
                            ActionDot(risk: action.risk)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(action.label).font(.caption).foregroundStyle(.white)
                                Text(action.confirmation_required == true ? "Confirm required" : action.risk.capitalized)
                                    .font(.system(size: 9))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(8)
                    .background(.white.opacity(action.enabled ? 0.1 : 0.04), in: RoundedRectangle(cornerRadius: 14))
                    .disabled(!action.enabled)
                }
            }
            .padding(.horizontal, 4)
        }
        .containerBackground(.black.gradient, for: .navigation)
    }
}

struct ConfirmationView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        VStack(spacing: 8) {
            OyiOrb(state: session.pendingConfirmation == nil ? session.state : .confirmationRequired)
            Text(session.pendingConfirmation == nil ? "No confirmation" : "Confirm action?")
                .font(.headline)
                .foregroundStyle(.white)
            Text(session.pendingConfirmation == nil ? "Nothing is pending" : session.detail)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
            HStack(spacing: 6) {
                Button("Cancel") { Task { await session.cancel() } }
                    .tint(.gray)
                    .controlSize(.small)
                Button("Confirm") { Task { await session.confirm() } }
                    .tint(.blue)
                    .controlSize(.small)
            }
            .disabled(session.pendingConfirmation == nil)
        }
        .containerBackground(.black.gradient, for: .navigation)
    }
}

struct OyiOrb: View {
    let state: OyiWatchState
    @State private var pulse = false

    var body: some View {
        Circle()
            .fill(.radialGradient(colors: colors, center: .center, startRadius: 4, endRadius: 58))
            .frame(width: 76, height: 76)
            .overlay(Circle().stroke(.white.opacity(0.16), lineWidth: 1))
            .scaleEffect(pulse ? 1.04 : 0.98)
            .shadow(color: colors.first?.opacity(0.38) ?? .blue.opacity(0.3), radius: state == .alert ? 24 : 16)
            .overlay(Text("Oyi").font(.headline).foregroundStyle(.white))
            .onAppear {
                withAnimation(.easeInOut(duration: state == .alert ? 0.75 : 1.6).repeatForever(autoreverses: true)) {
                    pulse = true
                }
            }
    }

    var colors: [Color] {
        switch state {
        case .alert, .failed: return [.red.opacity(0.8), .black]
        case .success: return [.green.opacity(0.8), .black]
        case .confirmationRequired: return [.orange.opacity(0.8), .black]
        case .executing, .thinking: return [.blue.opacity(0.9), .black]
        case .listening: return [.cyan.opacity(0.9), .blue.opacity(0.25), .black]
        default: return [.cyan.opacity(0.75), .black]
        }
    }
}

struct ActionDot: View {
    let risk: String

    var body: some View {
        Circle()
            .fill(color.opacity(0.22))
            .frame(width: 24, height: 24)
            .overlay(Circle().fill(color).frame(width: 7, height: 7))
    }

    var color: Color {
        switch risk {
        case "medium": return .orange
        case "high": return .red
        case "low": return .blue
        default: return .green
        }
    }
}
