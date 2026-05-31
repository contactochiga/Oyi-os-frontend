import SwiftUI
import Foundation
import Security
import UserNotifications
import WatchConnectivity
import WatchKit

@main
struct OyiWatchApp: App {
    @WKExtensionDelegateAdaptor(OyiWatchExtensionDelegate.self) private var extensionDelegate
    @StateObject private var session = OyiWatchSession()

    var body: some Scene {
        WindowGroup {
            OyiWatchRootView()
                .environmentObject(session)
        }
    }
}

extension Notification.Name {
    static let oyiWatchAlertReceived = Notification.Name("oyi.watch.alert.received")
}

final class OyiWatchExtensionDelegate: NSObject, WKExtensionDelegate, UNUserNotificationCenterDelegate {
    func applicationDidFinishLaunching() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.setNotificationCategories([
            category("OYI_VISITOR_ALERT"),
            category("OYI_SECURITY_ALERT"),
            category("OYI_ENVIRONMENT_ALERT"),
            category("OYI_DEVICE_ALERT")
        ])
    }

    private func category(_ identifier: String) -> UNNotificationCategory {
        UNNotificationCategory(identifier: identifier, actions: [], intentIdentifiers: [], options: [.customDismissAction])
    }

    private func publish(_ notification: UNNotification) {
        NotificationCenter.default.post(name: .oyiWatchAlertReceived, object: nil, userInfo: [
            "title": notification.request.content.title,
            "detail": notification.request.content.body,
            "category": notification.request.content.categoryIdentifier
        ])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        publish(notification)
        completionHandler([.sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        publish(response.notification)
        completionHandler()
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

enum OyiWatchConnectionState: String {
    case neverConnected
    case connecting
    case connected
    case syncFailed
    case offlineWithLastSync
    case tokenMissing
    case backendMissing
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
    let device_id: String?
    let command: [String: AnyDecodable]?
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
struct HomeStatusPayload: Decodable {
    let state: String?
    let title: String?
    let summary: String?
    let home_name: String?
    let estate_name: String?
    let updated_at: String?
}

struct AnyDecodable: Decodable {
    let value: Any
    var stringValue: String? { value as? String }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) { self.value = value }
        else if let value = try? container.decode(Bool.self) { self.value = value }
        else if let value = try? container.decode(Int.self) { self.value = value }
        else if let value = try? container.decode(Double.self) { self.value = value }
        else { self.value = "" }
    }
}


enum OyiSpeechError: Error {
    case unavailable
    case permissionDenied
    case emptyTranscript
}

final class OyiWatchSpeechCapture {
    @MainActor
    func capture() async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            guard let controller = WKExtension.shared().visibleInterfaceController else {
                continuation.resume(throwing: OyiSpeechError.unavailable)
                return
            }

            controller.presentTextInputController(
                withSuggestions: [
                    "Show home status",
                    "Turn off living room light",
                    "Turn off AC",
                    "Open activity"
                ],
                allowedInputMode: .plain
            ) { results in
                let transcript = results?
                    .compactMap { $0 as? String }
                    .first?
                    .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

                if transcript.isEmpty {
                    continuation.resume(throwing: OyiSpeechError.emptyTranscript)
                } else {
                    continuation.resume(returning: transcript)
                }
            }
        }
    }
}
final class OyiWatchSession: ObservableObject {
    @Published var state: OyiWatchState = .awareness
    @Published var connectionState: OyiWatchConnectionState = .neverConnected
    @Published var title: String = "Companion not connected"
    @Published var detail: String = "Open Oyi Home on iPhone and tap Sync Watch."
    @Published var homeName: String = "Oyi Watch"
    @Published var estateName: String = ""
    @Published var liveDataError: String?
    @Published var glances: [OyiGlance] = []
    @Published var actions: [OyiQuickAction] = []
    @Published var pendingConfirmation: OyiConfirmation?
    @Published var activePage: Int = 0
    @Published var isMockMode: Bool = false
    @Published var connectionLabel: String = "Waiting for sync"
    @Published var modeLabel: String = "Not connected"
    @Published var backendURLPresent: Bool = false
    @Published var tokenPresent: Bool = false
    @Published var lastBackendCallStatus: String = "none"
    @Published var lastSyncAt: String = "never"
    @Published var heardCommand: String = ""
    @Published var lastSuccessfulSyncAt: String = "never"
    @Published var isDeveloperPreview: Bool = false

    private let keychain = OyiWatchKeychain()
    private let speechCapture = OyiWatchSpeechCapture()
    private lazy var connectivity = OyiWatchConnectivityBridge(session: self)

    private var baseURL: URL?
    private var bearerToken: String?
    private var lastSuccessfulBackendAtISO: String?
    private let defaults = UserDefaults.standard

    init() {
        restorePersistentState()
        loadConfiguration()
        connectivity.activate()
    }

    func refresh() async {
        loadConfiguration()
        guard hasBackendConfiguration else {
            await applyDisconnectedState()
            return
        }
        await MainActor.run {
            connectionState = .connecting
            connectionLabel = "Connecting"
            if title == "Companion not connected" { detail = "Syncing your secure session" }
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

    func startVoiceCommand(fallbackCommand: String = "show home status") async {
        await MainActor.run {
            setListening()
            heardCommand = ""
        }
        do {
            let transcript = try await speechCapture.capture()
            let command = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !command.isEmpty else { throw OyiSpeechError.emptyTranscript }
            await MainActor.run {
                state = .thinking
                title = "Heard command"
                detail = command
                heardCommand = command
            }
            try? await Task.sleep(nanoseconds: 450_000_000)
            await run(command: command)
        } catch let error as OyiSpeechError {
            switch error {
            case .permissionDenied, .unavailable:
                await MainActor.run {
                    state = .failed
                    title = "Speech unavailable"
                    detail = isDeveloperPreview ? "Using preview command" : "Use quick actions instead"
                }
                if isDeveloperPreview { await run(command: fallbackCommand) }
            case .emptyTranscript:
                await MainActor.run {
                    state = .failed
                    title = "Nothing heard"
                    detail = "Tap Talk again"
                    lastBackendCallStatus = "speech: empty"
                }
            }
        } catch {
            await MainActor.run {
                state = .failed
                title = "Could not listen"
                detail = "Tap Talk again"
                lastBackendCallStatus = "speech: \(error.localizedDescription)"
            }
        }
    }

    func simulateVoiceCommand(_ command: String = "show home status") async {
        await MainActor.run {
            setListening()
        }
        try? await Task.sleep(nanoseconds: 550_000_000)
        await run(command: command)
    }

    func openQuickActions() {
        activePage = 2
        if hasBackendConfiguration && connectionState == .connected {
            state = .awareness
            title = "Quick actions"
            detail = "Choose one action"
        }
    }

    func retryConnection() {
        Task { await refresh() }
    }

    func run(command: String) async {
        await MainActor.run {
            state = .thinking
            title = "Working"
            detail = "Preparing..."
            activePage = 0
        }
        guard hasBackendConfiguration else {
            await commandUnavailable()
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
        guard hasBackendConfiguration, connectionState == .connected else {
            await commandUnavailable()
            return
        }
        do {
            var body: [String: Any] = ["action_id": action.id]
            if let deviceID = action.device_id { body["device_id"] = deviceID }
            if let command = action.command {
                body["device_command"] = command.mapValues(\.value)
            }
            let response: OyiWatchCommandResponse = try await request("/watch/command", method: "POST", body: body)
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
                activePage = 3
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
            await commandUnavailable()
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
        await refreshAfterCommand()
    }

    func applyCompanionPayload(_ payload: [String: Any], source: String = "watchconnectivity") async {
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
            isMockMode = isDeveloperPreview
            modeLabel = hasBackendConfiguration ? "Synced" : "Not connected"
            backendURLPresent = baseURL != nil
            tokenPresent = bearerToken?.isEmpty == false
            lastSyncAt = payload["sentAt"] as? String ?? Date().formatted(date: .omitted, time: .shortened)
            lastBackendCallStatus = "sync: \(source)"
            connectionLabel = hasBackendConfiguration ? "Connecting" : "Waiting for sync"
            connectionState = hasBackendConfiguration ? .connecting : connectionStateForMissingConfig()
            if updated {
                title = "Connecting…"
                detail = "Syncing your secure session"
                state = .thinking
                liveDataError = nil
            }
        }
        persistState()
        if didUpdate { await refresh() }
    }

    var canRunCommands: Bool {
        connectionState == .connected
    }

    var isDisconnected: Bool {
        connectionState == .neverConnected || connectionState == .tokenMissing || connectionState == .backendMissing || connectionState == .syncFailed
    }

    private var hasBackendConfiguration: Bool {
        baseURL != nil && bearerToken?.isEmpty == false
    }

    private func loadConfiguration() {
        let environment = ProcessInfo.processInfo.environment
        isDeveloperPreview = environment["OYI_WATCH_DEMO_MODE"] == "1"
        let envURL = environment["OYI_WATCH_BACKEND_URL"].flatMap(URL.init(string:))
        let envToken = environment["OYI_WATCH_DEV_TOKEN"]
        let storedURL = keychain.read(account: "backendBaseURL").flatMap(URL.init(string:))
        let storedToken = keychain.read(account: "bearerToken")
        baseURL = envURL ?? storedURL
        bearerToken = envToken ?? storedToken
        let nextMode = hasBackendConfiguration ? (envToken?.isEmpty == false ? "Dev Token" : "Synced") : (isDeveloperPreview ? "Preview" : "Not connected")
        DispatchQueue.main.async {
            self.isMockMode = self.isDeveloperPreview
            self.modeLabel = nextMode
            self.backendURLPresent = self.baseURL != nil
            self.tokenPresent = self.bearerToken?.isEmpty == false
            if self.hasBackendConfiguration {
                if self.connectionState == .neverConnected || self.connectionState == .tokenMissing || self.connectionState == .backendMissing {
                    self.connectionState = .connecting
                }
                self.connectionLabel = self.connectionState == .connected ? "Connected" : "Connecting"
            } else {
                self.connectionState = self.connectionStateForMissingConfig()
                self.connectionLabel = "Waiting for sync"
            }
        }
    }

    private func connectionStateForMissingConfig() -> OyiWatchConnectionState {
        if baseURL == nil && bearerToken?.isEmpty == false { return .backendMissing }
        if baseURL != nil && !(bearerToken?.isEmpty == false) { return .tokenMissing }
        return .neverConnected
    }

    private func apply(_ response: OyiWatchCommandResponse) async {
        let shouldRefresh = response.state == "success" || response.state == "executed" || response.state == "queued"
        await MainActor.run {
            detail = response.reply
            activePage = 0
            if response.state == "confirmation_required", let confirmation = response.confirmations?.first {
                state = .confirmationRequired
                title = "Confirm?"
                pendingConfirmation = confirmation
                activePage = 3
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
        if shouldRefresh { await refreshAfterCommand() }
    }

    private func fetchStatus() async {
        do {
            let payload: HomeStatusPayload = try await request("/watch/home-status")
            let successfulAt = ISO8601DateFormatter().string(from: Date())
            lastSuccessfulBackendAtISO = successfulAt
            await MainActor.run {
                title = payload.title ?? payload.home_name ?? title
                detail = payload.summary ?? detail
                homeName = payload.home_name ?? payload.title ?? homeName
                estateName = payload.estate_name ?? estateName
                state = payload.state == "attention" ? .alert : .awareness
                connectionState = .connected
                connectionLabel = "Connected"
                isMockMode = false
                modeLabel = "Synced"
                liveDataError = nil
                lastSuccessfulSyncAt = Date().formatted(date: .omitted, time: .shortened)
            }
            persistState()
            connectivity.sendAcknowledgement(payload: acknowledgementPayload())
        } catch { await applyLiveDataFailure(error) }
    }

    private func fetchGlances() async {
        do {
            let payload: GlancePayload = try await request("/watch/glances")
            await MainActor.run {
                glances = payload.items
                liveDataError = nil
            }
        } catch {
            await MainActor.run {
                glances = []
                liveDataError = "Glances unavailable"
            }
        }
    }

    private func fetchActions() async {
        do {
            let payload: ActionPayload = try await request("/watch/quick-actions")
            await MainActor.run {
                actions = payload.actions
                liveDataError = nil
            }
        } catch {
            await MainActor.run {
                actions = []
                liveDataError = "Actions unavailable"
            }
        }
    }

    private func refreshAfterCommand() async {
        try? await Task.sleep(nanoseconds: 350_000_000)
        await fetchStatus()
        await fetchGlances()
        await fetchActions()
    }

    private func applyLiveDataFailure(_ error: Error) async {
        await MainActor.run {
            state = .failed
            if lastSuccessfulSyncAt != "never" {
                connectionState = .offlineWithLastSync
                connectionLabel = "Offline"
                title = title.isEmpty ? "Offline" : title
                detail = "Offline · Last synced: \(lastSuccessfulSyncAt)"
                actions = actions.map { OyiQuickAction(id: $0.id, label: $0.label, prompt: $0.prompt, risk: $0.risk, enabled: false, confirmation_required: $0.confirmation_required, device_id: $0.device_id, command: $0.command) }
            } else {
                connectionState = .syncFailed
                connectionLabel = "Retry"
                title = "Connection failed"
                detail = "Open iPhone and retry Sync Watch."
                glances = []
                actions = []
            }
            liveDataError = error.localizedDescription.isEmpty ? "Backend unavailable" : error.localizedDescription
            lastBackendCallStatus = liveDataError ?? "failed"
        }
        persistState(error: error.localizedDescription)
        connectivity.sendAcknowledgement(payload: acknowledgementPayload())
    }

    private func request<T: Decodable>(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> T {
        let data = try await requestRaw(path, method: method, body: body)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func requestRaw(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> Data {
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

    private func applyDisconnectedState() async {
        await MainActor.run {
            isMockMode = isDeveloperPreview
            backendURLPresent = baseURL != nil
            tokenPresent = bearerToken?.isEmpty == false
            liveDataError = nil
            pendingConfirmation = nil
            if isDeveloperPreview {
                connectionState = .connected
                modeLabel = "Preview"
                connectionLabel = "Preview"
                homeName = "Oyi Preview"
                estateName = ""
                title = "Developer preview"
                detail = "Demo mode is explicit"
                glances = Self.previewGlances
                actions = Self.previewActions
            } else {
                connectionState = connectionStateForMissingConfig()
                modeLabel = "Not connected"
                connectionLabel = "Waiting for sync"
                homeName = "Oyi Watch"
                estateName = ""
                title = connectionState == .tokenMissing ? "Session token missing" : connectionState == .backendMissing ? "Backend missing" : "Companion not connected"
                detail = "Open Oyi Home on iPhone and tap Sync Watch."
                glances = []
                actions = []
            }
        }
    }

    private func commandUnavailable() async {
        await MainActor.run {
            state = .failed
            title = "Not connected"
            detail = "Sync from iPhone before running commands."
            pendingConfirmation = nil
            activePage = 0
        }
    }

    func showAlert(title: String, detail: String) {
        self.title = title.isEmpty ? "Home alert" : title
        self.detail = detail.isEmpty ? "Open Oyi Home for details." : detail
        self.state = .alert
        self.activePage = 0
    }

    func acknowledgementPayload() -> [String: Any] {
        var payload: [String: Any] = [
            "type": "oyi.watch.sync.ack",
            "acknowledgedAt": ISO8601DateFormatter().string(from: Date()),
            "mode": modeLabel
        ]
        if let lastSuccessfulBackendAtISO { payload["backendSuccessAt"] = lastSuccessfulBackendAtISO }
        if let liveDataError { payload["error"] = liveDataError }
        return payload
    }

    private func restorePersistentState() {
        if let stored = defaults.string(forKey: "oyi.watch.lastSuccessfulBackendAt") {
            lastSuccessfulBackendAtISO = stored
            lastSuccessfulSyncAt = displayTimestamp(stored)
        }
        if let stored = defaults.string(forKey: "oyi.watch.lastSyncAt") {
            lastSyncAt = stored
        }
        liveDataError = defaults.string(forKey: "oyi.watch.lastError")
    }

    private func persistState(error: String? = nil) {
        defaults.set(lastSuccessfulBackendAtISO, forKey: "oyi.watch.lastSuccessfulBackendAt")
        defaults.set(lastSyncAt, forKey: "oyi.watch.lastSyncAt")
        defaults.set(error, forKey: "oyi.watch.lastError")
    }

    private func displayTimestamp(_ value: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: value) else { return value }
        return date.formatted(date: .omitted, time: .shortened)
    }

    static let previewGlances: [OyiGlance] = [
        OyiGlance(id: "home", type: "awareness", title: "Home calm", detail: "All systems normal", state: "calm"),
        OyiGlance(id: "visitor", type: "visitor", title: "Visitor at gate", detail: "Front gate", state: "unread"),
        OyiGlance(id: "climate", type: "climate", title: "Living room", detail: "24° · Cool", state: "online")
    ]

    static let previewActions: [OyiQuickAction] = [
        OyiQuickAction(id: "show_status", label: "Home status", prompt: "show home status", risk: "read", enabled: true, confirmation_required: false, device_id: nil, command: nil),
        OyiQuickAction(id: "all_lights_off", label: "Lights off", prompt: "turn off lights", risk: "low", enabled: true, confirmation_required: false, device_id: nil, command: nil),
        OyiQuickAction(id: "movie_mode", label: "Movie mode", prompt: "activate movie mode", risk: "low", enabled: true, confirmation_required: false, device_id: nil, command: nil),
        OyiQuickAction(id: "arm_security", label: "Arm security", prompt: "arm security", risk: "medium", enabled: true, confirmation_required: true, device_id: nil, command: nil)
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
        Task { await sessionModel?.applyCompanionPayload(applicationContext, source: "applicationContext") }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any]) {
        Task { await sessionModel?.applyCompanionPayload(userInfo, source: "userInfo") }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        Task { await sessionModel?.applyCompanionPayload(message, source: "message") }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        Task {
            await sessionModel?.applyCompanionPayload(message, source: "message")
            replyHandler(sessionModel?.acknowledgementPayload() ?? ["type": "oyi.watch.sync.ack"])
        }
    }

    func sendAcknowledgement(payload: [String: Any]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        let envelope: [String: Any] = ["oyiWatchAck": payload]
        try? session.updateApplicationContext(envelope)
        session.transferUserInfo(envelope)
        if session.isReachable {
            session.sendMessage(envelope, replyHandler: nil, errorHandler: nil)
        }
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
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView(selection: $session.activePage) {
            AwarenessView().tag(0)
            GlancesView().tag(1)
            QuickActionsView().tag(2)
            ConfirmationView().tag(3)
        }
        .tabViewStyle(.verticalPage)
        .task { await session.refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await session.refresh() } }
        }
        .onReceive(NotificationCenter.default.publisher(for: .oyiWatchAlertReceived)) { notification in
            session.showAlert(
                title: notification.userInfo?["title"] as? String ?? "Home alert",
                detail: notification.userInfo?["detail"] as? String ?? "Open Oyi Home for details."
            )
        }
    }
}

struct AwarenessView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        WatchSurface {
            WatchChrome(label: chromeLabel, isMock: session.isDeveloperPreview || session.connectionState != .connected)
            Spacer(minLength: 2)
            OyiOrb(state: orbState)
            Text(session.title)
                .font(.system(size: session.isDisconnected ? 14 : 15, weight: .semibold, design: .rounded))
                .foregroundStyle(titleColor)
                .multilineTextAlignment(.center)
                .lineLimit(2)
            Text(session.detail)
                .font(.system(size: 10.5, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.68))
                .multilineTextAlignment(.center)
                .lineLimit(3)
            if session.connectionState == .connecting {
                OyiWaveform(color: .blue).frame(height: 16).padding(.top, 1)
            } else if session.isDisconnected {
                disconnectedChips
                WatchPillButton(title: "Retry", tint: .blue) { session.retryConnection() }
                    .padding(.top, 1)
            } else if session.connectionState == .offlineWithLastSync {
                Text("Offline · actions paused")
                    .font(.system(size: 8.5, weight: .medium, design: .rounded))
                    .foregroundStyle(.orange.opacity(0.85))
                WatchPillButton(title: "Retry", tint: .blue) { session.retryConnection() }
            } else if session.state == .listening {
                OyiWaveform(color: .blue)
                    .frame(height: 16 * scale)
                    .padding(.top, 1)
            } else {
                HStack(spacing: 8) {
                    WatchPillButton(title: "Talk", tint: .blue) { Task { await session.startVoiceCommand(fallbackCommand: "show home status") } }
                    WatchPillButton(title: "Actions", tint: .blue) { session.openQuickActions() }
                }
                .padding(.top, 2)
            }
            if session.isDeveloperPreview { WatchDiagnosticsView() }
        }
    }

    private var chromeLabel: String {
        switch session.connectionState {
        case .connected: return session.homeName
        case .connecting: return "Connecting"
        case .offlineWithLastSync: return "Offline"
        case .tokenMissing: return "Token missing"
        case .backendMissing: return "Backend missing"
        case .syncFailed: return "Retry"
        case .neverConnected: return "Not connected"
        }
    }

    private var orbState: OyiWatchState {
        if session.connectionState == .connecting { return .thinking }
        if session.isDisconnected { return .failed }
        return session.state
    }

    private var disconnectedChips: some View {
        HStack(spacing: 4) {
            StatusChip("iPhone required")
            StatusChip(session.connectionState == .tokenMissing ? "Token missing" : "Waiting for sync")
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

struct GlancesView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        WatchSurface(alignment: .top) {
            WatchChrome(label: "Glances", isMock: session.connectionState != .connected)
            if session.connectionState != .connected {
                VStack(spacing: 8) {
                    OyiOrb(state: session.connectionState == .offlineWithLastSync ? .failed : .awareness)
                    Text(session.connectionState == .offlineWithLastSync ? "Offline" : "No live glances")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                    Text(session.connectionState == .offlineWithLastSync ? "Last synced \(session.lastSuccessfulSyncAt)" : "Sync from iPhone to load home activity.")
                        .font(.system(size: 10, design: .rounded))
                        .foregroundStyle(.white.opacity(0.56))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if session.glances.isEmpty {
                VStack(spacing: 8) {
                    OyiOrb(state: .awareness)
                    Text("Home is quiet")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                    Text("No watch-ready updates yet.")
                        .font(.system(size: 10, design: .rounded))
                        .foregroundStyle(.white.opacity(0.56))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 6) {
                        ForEach(session.glances.prefix(6)) { glance in
                            HStack(spacing: 8) {
                                GlanceIcon(type: glance.type, state: glance.state)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(glance.title)
                                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                                        .foregroundStyle(.white)
                                        .lineLimit(1)
                                    Text(glance.detail)
                                        .font(.system(size: 9, design: .rounded))
                                        .foregroundStyle(.white.opacity(0.54))
                                        .lineLimit(2)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(7)
                            .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                }
            }
        }
    }
}


struct StatusChip: View {
    let label: String
    init(_ label: String) { self.label = label }

    var body: some View {
        Text(label)
            .font(.system(size: 7.5, weight: .semibold, design: .rounded))
            .foregroundStyle(.white.opacity(0.62))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(.white.opacity(0.055), in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.08), lineWidth: 1))
    }
}

struct WatchDiagnosticsView: View {
    @EnvironmentObject var session: OyiWatchSession

    var body: some View {
        VStack(spacing: 1) {
            Text("Mode: \(session.modeLabel) | Backend: \(session.backendURLPresent ? "Present" : "Missing")")
                .font(.system(size: 7, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.46))
                .lineLimit(1)
            Text("Token: \(session.tokenPresent ? "Present" : "Missing") | Last Sync: \(session.lastSyncAt)")
                .font(.system(size: 7, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.35))
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
    @Environment(\.oyiWatchScale) private var scale

    private let columns = [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)]

    var body: some View {
        WatchSurface(alignment: .top) {
            WatchChrome(label: "Actions", isMock: session.connectionState != .connected)
            if session.connectionState != .connected {
                VStack(spacing: 8) {
                    OyiOrb(state: session.connectionState == .offlineWithLastSync ? .failed : .awareness)
                    Text(session.connectionState == .offlineWithLastSync ? "Actions paused" : "No actions available")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                    Text(session.connectionState == .offlineWithLastSync ? "Reconnect to Oyi Home before running commands." : "Sync from iPhone to load real home actions.")
                        .font(.system(size: 10, weight: .regular, design: .rounded))
                        .foregroundStyle(.white.opacity(0.56))
                        .multilineTextAlignment(.center)
                    WatchPillButton(title: "Retry", tint: .blue) { session.retryConnection() }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if session.actions.isEmpty {
                VStack(spacing: 8) {
                    OyiOrb(state: .awareness)
                    Text("No actions yet")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                    Text(session.liveDataError ?? "No watch-ready actions returned for this home.")
                        .font(.system(size: 10, weight: .regular, design: .rounded))
                        .foregroundStyle(.white.opacity(0.56))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
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
                        .frame(maxWidth: .infinity, minHeight: 54 * scale)
                        .padding(max(4, 5 * scale))
                        .background(.white.opacity(action.enabled ? 0.07 : 0.03), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.1), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(!action.enabled)
                }
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
            WatchChrome(label: "Confirm", isMock: session.connectionState != .connected)
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
        GeometryReader { geometry in
            let shortSide = min(geometry.size.width, geometry.size.height)
            let longSide = max(geometry.size.width, geometry.size.height)
            let scale = min(max(shortSide / 184, 0.88), 1.28)
            let horizontalPadding = max(2, shortSide * 0.018)
            let verticalPadding = max(1, longSide * 0.008)
            VStack(spacing: 6 * scale, content: content)
                .environment(\.oyiWatchScale, scale)
                .padding(.horizontal, horizontalPadding)
                .padding(.vertical, verticalPadding)
                .frame(width: geometry.size.width, height: geometry.size.height, alignment: alignment == .top ? .top : .center)
        }
        .ignoresSafeArea(.container, edges: .all)
        .background(
            ZStack {
                Color.black
                RadialGradient(colors: [.blue.opacity(0.18), .clear], center: .top, startRadius: 8, endRadius: 120)
                LinearGradient(colors: [.white.opacity(0.035), .clear], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
            .ignoresSafeArea()
        )
        .containerBackground(.black.gradient, for: .navigation)
    }
}

struct WatchChrome: View {
    @Environment(\.oyiWatchScale) private var scale
    let label: String
    let isMock: Bool

    var body: some View {
        HStack(alignment: .top) {
            Circle()
                .fill(isMock ? .orange.opacity(0.85) : .green.opacity(0.85))
                .frame(width: 5, height: 5)
            Text(label)
                .font(.system(size: 8, weight: .semibold, design: .rounded))
                .foregroundStyle(isMock ? .orange.opacity(0.85) : .green.opacity(0.85))
                .lineLimit(1)
            Spacer()
        }
        .frame(height: 16 * scale)
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
    @Environment(\.oyiWatchScale) private var scale

    var body: some View {
        ZStack {
            Circle()
                .stroke(color.opacity(0.85), lineWidth: 2)
                .frame(width: 76 * scale, height: 76 * scale)
                .blur(radius: pulse ? 0.2 : 0.9)
            Circle()
                .fill(.radialGradient(colors: [color.opacity(0.5), .blue.opacity(0.11), .black], center: .center, startRadius: 3, endRadius: 43))
                .frame(width: 68 * scale, height: 68 * scale)
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

private struct OyiWatchScaleKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

extension EnvironmentValues {
    var oyiWatchScale: CGFloat {
        get { self[OyiWatchScaleKey.self] }
        set { self[OyiWatchScaleKey.self] = newValue }
    }
}

struct GlanceIcon: View {
    let type: String
    let state: String?

    var body: some View {
        Circle()
            .fill(color.opacity(0.17))
            .frame(width: 30, height: 30)
            .overlay(Image(systemName: symbol).font(.system(size: 13, weight: .semibold)).foregroundStyle(color))
    }

    private var symbol: String {
        let key = type.lowercased()
        if key.contains("visitor") { return "person.fill" }
        if key.contains("security") || key.contains("access") { return "lock.shield.fill" }
        if key.contains("climate") || key.contains("hvac") { return "thermometer.medium" }
        if key.contains("device") || key.contains("light") { return "lightbulb.fill" }
        return "house.fill"
    }

    private var color: Color {
        String(state ?? "").lowercased().contains("offline") ? .red : .blue
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
