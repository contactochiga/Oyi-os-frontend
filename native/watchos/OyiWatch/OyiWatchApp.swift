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
    @Published var modeLabel: String = "Mock"
    @Published var backendURLPresent: Bool = false
    @Published var tokenPresent: Bool = false
    @Published var lastBackendCallStatus: String = "none"

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
        let updated = didUpdate
        await MainActor.run {
            isMockMode = !hasBackendConfiguration
            modeLabel = hasBackendConfiguration ? "Synced" : "Mock"
            backendURLPresent = baseURL != nil
            tokenPresent = bearerToken?.isEmpty == false
            connectionLabel = hasBackendConfiguration ? "Connected" : "Mock mode"
            if updated {
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
        let storedURL = keychain.read(account: "backendBaseURL").flatMap(URL.init(string:))
        let storedToken = keychain.read(account: "bearerToken")
        baseURL = envURL ?? storedURL
        bearerToken = envToken ?? storedToken
        let nextMode = hasBackendConfiguration ? (envToken?.isEmpty == false ? "Dev Token" : "Synced") : "Mock"
        DispatchQueue.main.async {
            self.isMockMode = !self.hasBackendConfiguration
            self.modeLabel = nextMode
            self.backendURLPresent = self.baseURL != nil
            self.tokenPresent = self.bearerToken?.isEmpty == false
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
        guard let http = response as? HTTPURLResponse else {
            await MainActor.run { self.lastBackendCallStatus = "no http response" }
            throw URLError(.badServerResponse)
        }
        await MainActor.run { self.lastBackendCallStatus = "\(method) \(path): \(http.statusCode)" }
        guard (200..<300).contains(http.statusCode) else { throw URLError(.badServerResponse) }
        return data
    }

    private func fallbackFailure(_ error: Error) async {
        await MainActor.run {
            state = .failed
            title = "Not completed"
            detail = error.localizedDescription.isEmpty ? "Try again" : "Backend unavailable"
            lastBackendCallStatus = error.localizedDescription.isEmpty ? "failed" : error.localizedDescription
            pendingConfirmation = nil
        }
    }

    private func applyMockHome() async {
        await MainActor.run {
            isMockMode = true
            modeLabel = "Mock"
            backendURLPresent = baseURL != nil
            tokenPresent = bearerToken?.isEmpty == false
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
        WatchSurface {
            WatchChrome(label: session.connectionLabel, isMock: session.isMockMode) {
                session.openQuickActions()
            }
            Spacer(minLength: 2)
            OyiOrb(state: session.state)
            Text(session.title)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(titleColor)
                .lineLimit(1)
            Text(session.detail)
                .font(.system(size: 10, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.62))
                .multilineTextAlignment(.center)
                .lineLimit(2)
            WatchDiagnosticsView()
            if session.state == .listening {
                OyiWaveform(color: .blue)
                    .frame(height: 18)
                    .padding(.top, 1)
            } else {
                HStack(spacing: 8) {
                    WatchPillButton(title: "Talk", tint: .blue) { Task { await session.simulateVoiceCommand("turn off downstairs lights") } }
                    WatchPillButton(title: "Alert", tint: .orange) { session.showAlertDemo() }
                }
                .padding(.top, 2)
            }
        }
    }

    private var titleColor: Color {
        switch session.state {
        case .success: return .green
        case .alert, .failed: return .red
        case .confirmationRequired: return .orange
        default: return .blue
        }
    }
}

struct WatchDiagnosticsView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        VStack(spacing: 1) {
            Text("mode: \(session.modeLabel) | url: \(session.backendURLPresent ? "yes" : "no") | token: \(session.tokenPresent ? "yes" : "no")")
                .font(.system(size: 7, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.46))
                .lineLimit(1)
            Text("last: \(session.lastBackendCallStatus)")
                .font(.system(size: 7, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.35))
                .lineLimit(1)
        }
        .padding(.horizontal, 4)
    }
}

struct QuickActionsView: View {
    @EnvironmentObject var session: OyiWatchSession

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        WatchSurface(alignment: .top) {
            WatchChrome(label: "Actions", isMock: session.isMockMode) {
                session.activePage = 0
            }
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(session.actions.prefix(4)) { action in
                    Button {
                        Task { await session.run(action: action) }
                    } label: {
                        VStack(spacing: 5) {
                            ActionIcon(action: action)
                            Text(shortLabel(action.label))
                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                .foregroundStyle(.white)
                                .lineLimit(2)
                                .multilineTextAlignment(.center)
                            Text(action.confirmation_required == true ? "Confirm" : "Activate")
                                .font(.system(size: 8, weight: .regular, design: .rounded))
                                .foregroundStyle(.white.opacity(0.45))
                        }
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .padding(6)
                        .background(.white.opacity(action.enabled ? 0.07 : 0.03), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.1), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(!action.enabled)
                }
            }
        }
    }

    private func shortLabel(_ label: String) -> String {
        label.replacingOccurrences(of: "All lights off", with: "Lights Off")
    }
}

struct ConfirmationView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        WatchSurface {
            WatchChrome(label: "Confirm", isMock: session.isMockMode) {
                session.activePage = 0
            }
            Spacer(minLength: 2)
            OyiOrb(state: session.pendingConfirmation == nil ? session.state : .confirmationRequired)
            Text(session.pendingConfirmation == nil ? "No confirmation" : confirmationTitle)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(session.pendingConfirmation == nil ? .white : .orange)
                .multilineTextAlignment(.center)
                .lineLimit(2)
            Text(session.pendingConfirmation == nil ? "Nothing is pending" : session.detail)
                .font(.system(size: 10, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.62))
                .multilineTextAlignment(.center)
                .lineLimit(2)
            HStack(spacing: 8) {
                WatchPillButton(title: "Cancel", tint: .gray) { Task { await session.cancel() } }
                WatchPillButton(title: "Confirm", tint: .blue) { Task { await session.confirm() } }
            }
            .disabled(session.pendingConfirmation == nil)
            .opacity(session.pendingConfirmation == nil ? 0.45 : 1)
        }
    }

    private var confirmationTitle: String {
        if session.detail.lowercased().contains("gate") { return "Open gate?" }
        if session.detail.lowercased().contains("security") { return "Arm security?" }
        return "Run action?"
    }
}

struct WatchSurface<Content: View>: View {
    var alignment: VerticalAlignment = .center
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 7, content: content)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: alignment == .top ? .top : .center)
            .padding(.horizontal, 7)
            .padding(.vertical, 5)
            .background(
                ZStack {
                    Color.black
                    RadialGradient(colors: [.blue.opacity(0.18), .clear], center: .top, startRadius: 8, endRadius: 120)
                    LinearGradient(colors: [.white.opacity(0.035), .clear], startPoint: .topLeading, endPoint: .bottomTrailing)
                }
            )
            .containerBackground(.black.gradient, for: .navigation)
    }
}

struct WatchChrome: View {
    let label: String
    let isMock: Bool
    let onMore: () -> Void

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.system(size: 8, weight: .semibold, design: .rounded))
                .foregroundStyle(isMock ? .orange.opacity(0.85) : .green.opacity(0.85))
                .lineLimit(1)
            Spacer()
            Text("9:41")
                .font(.system(size: 10, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
            Button(action: onMore) {
                VStack(spacing: 2) {
                    Circle().fill(.white.opacity(0.72)).frame(width: 3, height: 3)
                    Circle().fill(.white.opacity(0.52)).frame(width: 3, height: 3)
                    Circle().fill(.white.opacity(0.34)).frame(width: 3, height: 3)
                }
                .frame(width: 16, height: 20)
            }
            .buttonStyle(.plain)
        }
        .frame(height: 18)
    }
}

struct WatchPillButton: View {
    let title: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 10, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .frame(minWidth: 48)
                .padding(.vertical, 7)
                .background(tint.opacity(0.28), in: Capsule())
                .overlay(Capsule().stroke(tint.opacity(0.5), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

struct OyiOrb: View {
    let state: OyiWatchState
    @State private var pulse = false

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.85), lineWidth: 2)
                .frame(width: 76, height: 76)
                .blur(radius: pulse ? 0.2 : 0.9)
            Circle()
                .fill(.radialGradient(colors: [color.opacity(0.5), .blue.opacity(0.11), .black], center: .center, startRadius: 3, endRadius: 43))
                .frame(width: 68, height: 68)
                .shadow(color: color.opacity(0.75), radius: state == .alert ? 18 : 13)
            orbMark
        }
        .scaleEffect(pulse ? 1.04 : 0.98)
        .onAppear {
            withAnimation(.easeInOut(duration: state == .alert ? 0.72 : 1.45).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }

    private var orbMark: some View {
        Group {
            switch state {
            case .success:
                Image(systemName: "checkmark")
                    .font(.system(size: 28, weight: .semibold))
            case .alert, .failed:
                Image(systemName: "bell.fill")
                    .font(.system(size: 24, weight: .semibold))
            case .confirmationRequired:
                Image(systemName: "lock.fill")
                    .font(.system(size: 23, weight: .semibold))
            case .executing, .thinking:
                Circle().stroke(.blue, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [2, 6])).frame(width: 42, height: 42)
            default:
                Text("Oyi")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
            }
        }
        .foregroundStyle(.white)
    }

    private var color: Color {
        switch state {
        case .alert, .failed: return .red
        case .success: return .green
        case .confirmationRequired: return .orange
        case .executing, .thinking, .listening: return .blue
        default: return .blue
        }
    }
}

struct ActionIcon: View {
    let action: OyiQuickAction

    var body: some View {
        Circle()
            .fill(color.opacity(0.2))
            .frame(width: 30, height: 30)
            .overlay(Image(systemName: symbol).font(.system(size: 14, weight: .semibold)).foregroundStyle(color))
            .shadow(color: color.opacity(0.28), radius: 8)
    }

    private var symbol: String {
        let key = action.id.lowercased() + " " + action.label.lowercased()
        if key.contains("light") { return "lightbulb.fill" }
        if key.contains("security") { return "lock.shield.fill" }
        if key.contains("movie") { return "movieclapper.fill" }
        if key.contains("climate") { return "thermometer.medium" }
        return "house.fill"
    }

    private var color: Color {
        if action.confirmation_required == true || action.risk == "medium" { return .orange }
        if action.risk == "low" { return .blue }
        return .green
    }
}

struct OyiWaveform: View {
    let color: Color
    private let bars: [CGFloat] = [0.2, 0.55, 0.3, 0.8, 0.42, 1, 0.35, 0.62, 0.28, 0.75, 0.38, 0.5]

    var body: some View {
        HStack(alignment: .center, spacing: 2) {
            ForEach(Array(bars.enumerated()), id: \.offset) { _, value in
                Capsule()
                    .fill(color.opacity(0.8))
                    .frame(width: 2, height: max(4, value * 18))
                    .shadow(color: color.opacity(0.45), radius: 3)
            }
        }
    }
}
