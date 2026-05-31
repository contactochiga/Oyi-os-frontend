import Foundation
import Capacitor
import WatchConnectivity

@objc(OyiWatchSyncPlugin)
public class OyiWatchSyncPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
    private var lastSyncError: String?
    private var lastActivationError: String?
    private var activationTimedOut = false
    private var activationCallbacks: [(WCSession) -> Void] = []
    private var activationTimeoutWorkItem: DispatchWorkItem?
    private var lastSyncAt: String?
    private var lastTokenSent = false
    private var lastBackendSent = false
    private var lastAcknowledgedAt: String?
    private var lastBackendSuccessAt: String?
    private var lastWatchError: String?
    private var deliveryState = "not_connected"
    private let defaults = UserDefaults.standard
    private let acknowledgementWindow: TimeInterval = 24 * 60 * 60

    public let identifier = "OyiWatchSyncPlugin"
    public let jsName = "OyiWatchSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    private var session: WCSession? {
        guard WCSession.isSupported() else { return nil }
        return WCSession.default
    }

    public override func load() {
        super.load()
        restorePersistedStatus()
        activateSessionIfNeeded()
    }

    @objc func sync(_ call: CAPPluginCall) {
        guard session != nil else {
            call.resolve(["available": false, "synced": false, "reason": "watch_connectivity_unavailable"])
            return
        }

        guard let backendBaseURL = call.getString("backendBaseURL"), !backendBaseURL.isEmpty,
              let bearerToken = call.getString("bearerToken"), !bearerToken.isEmpty else {
            call.reject("missing_session", "backendBaseURL and bearerToken are required")
            return
        }

        activateSessionIfNeeded { [weak self] activatedSession in
            guard let self else { return }
            let result = self.performSync(
                session: activatedSession,
                backendBaseURL: backendBaseURL,
                bearerToken: bearerToken,
                call: call
            )
            call.resolve(result)
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        guard session != nil else {
            call.resolve(["available": false, "reason": "watch_connectivity_unavailable"])
            return
        }
        activateSessionIfNeeded { [weak self] activatedSession in
            guard let self else { return }
            call.resolve(self.statusPayload(session: activatedSession))
        }
    }

    private func performSync(session: WCSession, backendBaseURL: String, bearerToken: String, call: CAPPluginCall) -> [String: Any] {
        lastSyncError = nil
        var usedApplicationContext = false
        var usedTransferUserInfo = false
        var usedSendMessage = false
        var syncError: String?

        let sentAt = ISO8601DateFormatter().string(from: Date())
        lastSyncAt = sentAt
        lastTokenSent = !bearerToken.isEmpty
        lastBackendSent = !backendBaseURL.isEmpty
        deliveryState = "sync_queued"
        persistStatus()

        var payload: [String: Any] = [
            "backendBaseURL": backendBaseURL,
            "baseURL": backendBaseURL,
            "bearerToken": bearerToken,
            "authToken": bearerToken,
            "sentAt": sentAt
        ]

        if let userId = call.getString("userId"), !userId.isEmpty { payload["userId"] = userId }
        if let homeId = call.getString("homeId"), !homeId.isEmpty { payload["homeId"] = homeId }
        if let estateId = call.getString("estateId"), !estateId.isEmpty { payload["estateId"] = estateId }
        if let role = call.getString("role"), !role.isEmpty { payload["role"] = role }

        do {
            try session.updateApplicationContext(payload)
            usedApplicationContext = true
        } catch {
            syncError = error.localizedDescription
            lastSyncError = error.localizedDescription
        }

        if session.isPaired && session.isWatchAppInstalled {
            session.transferUserInfo(payload)
            usedTransferUserInfo = true
        }

        if session.isReachable {
            usedSendMessage = true
            deliveryState = "sync_sent"
            session.sendMessage(payload, replyHandler: { [weak self] reply in
                DispatchQueue.main.async {
                    self?.handleAcknowledgement(reply)
                }
            }) { [weak self] error in
                DispatchQueue.main.async {
                    self?.lastSyncError = error.localizedDescription
                    self?.deliveryState = "sync_failed"
                    self?.persistStatus()
                }
            }
        }

        persistStatus()
        var result = statusPayload(session: session)
        result["usedApplicationContext"] = usedApplicationContext
        result["usedTransferUserInfo"] = usedTransferUserInfo
        result["usedSendMessage"] = usedSendMessage
        result["error"] = syncError as Any
        result["lastSyncError"] = lastSyncError as Any
        return result
    }

    private func statusPayload(session: WCSession) -> [String: Any] {
        let connected = hasRecentAcknowledgement && deliveryState == "connected"
        return [
            "available": true,
            "paired": session.isPaired,
            "watchAppInstalled": session.isWatchAppInstalled,
            "installed": session.isWatchAppInstalled,
            "reachable": session.isReachable,
            "activationState": session.activationState.rawValue,
            "activationTimedOut": activationTimedOut,
            "tokenSent": lastTokenSent,
            "backendURLSent": lastBackendSent,
            "lastSyncAt": lastSyncAt as Any,
            "lastSyncError": lastSyncError as Any,
            "lastActivationError": lastActivationError as Any,
            "acknowledged": connected,
            "connected": connected,
            "synced": connected,
            "deliveryState": deliveryState,
            "lastAcknowledgedAt": lastAcknowledgedAt as Any,
            "lastBackendSuccessAt": lastBackendSuccessAt as Any,
            "lastWatchError": lastWatchError as Any
        ]
    }

    private var hasRecentAcknowledgement: Bool {
        guard let value = lastBackendSuccessAt ?? lastAcknowledgedAt,
              let date = ISO8601DateFormatter().date(from: value) else { return false }
        return Date().timeIntervalSince(date) <= acknowledgementWindow
    }

    private func handleAcknowledgement(_ payload: [String: Any]) {
        let acknowledgement = payload["oyiWatchAck"] as? [String: Any] ?? payload
        guard String(describing: acknowledgement["type"] ?? "") == "oyi.watch.sync.ack" else { return }
        lastAcknowledgedAt = acknowledgement["acknowledgedAt"] as? String ?? ISO8601DateFormatter().string(from: Date())
        lastBackendSuccessAt = acknowledgement["backendSuccessAt"] as? String
        lastWatchError = acknowledgement["error"] as? String
        if let lastWatchError, !lastWatchError.isEmpty {
            deliveryState = lastBackendSuccessAt == nil ? "sync_failed" : "offline"
        } else {
            deliveryState = lastBackendSuccessAt == nil ? "waiting_for_watch" : "connected"
        }
        persistStatus()
    }

    private func restorePersistedStatus() {
        lastSyncAt = defaults.string(forKey: "oyi.watch.lastSyncAt")
        lastAcknowledgedAt = defaults.string(forKey: "oyi.watch.lastAcknowledgedAt")
        lastBackendSuccessAt = defaults.string(forKey: "oyi.watch.lastBackendSuccessAt")
        lastWatchError = defaults.string(forKey: "oyi.watch.lastWatchError")
        deliveryState = defaults.string(forKey: "oyi.watch.deliveryState") ?? "not_connected"
        lastTokenSent = defaults.bool(forKey: "oyi.watch.tokenSent")
        lastBackendSent = defaults.bool(forKey: "oyi.watch.backendSent")
    }

    private func persistStatus() {
        defaults.set(lastSyncAt, forKey: "oyi.watch.lastSyncAt")
        defaults.set(lastAcknowledgedAt, forKey: "oyi.watch.lastAcknowledgedAt")
        defaults.set(lastBackendSuccessAt, forKey: "oyi.watch.lastBackendSuccessAt")
        defaults.set(lastWatchError, forKey: "oyi.watch.lastWatchError")
        defaults.set(deliveryState, forKey: "oyi.watch.deliveryState")
        defaults.set(lastTokenSent, forKey: "oyi.watch.tokenSent")
        defaults.set(lastBackendSent, forKey: "oyi.watch.backendSent")
    }

    private func activateSessionIfNeeded(completion: ((WCSession) -> Void)? = nil) {
        guard let session else { return }
        if session.delegate !== self {
            session.delegate = self
        }
        if session.activationState == .activated {
            completion?(session)
            return
        }
        if let completion {
            activationCallbacks.append(completion)
        }
        session.activate()
        scheduleActivationFallback(for: session)
    }

    private func scheduleActivationFallback(for session: WCSession) {
        guard activationTimeoutWorkItem == nil else { return }
        let item = DispatchWorkItem { [weak self, weak session] in
            guard let self, let session else { return }
            guard session.activationState != .activated, !self.activationCallbacks.isEmpty else { return }
            self.activationTimedOut = true
            self.lastActivationError = "watch_connectivity_activation_timeout"
            self.drainActivationCallbacks(with: session)
        }
        activationTimeoutWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: item)
    }

    private func drainActivationCallbacks(with session: WCSession) {
        activationTimeoutWorkItem?.cancel()
        activationTimeoutWorkItem = nil
        let callbacks = activationCallbacks
        activationCallbacks.removeAll()
        callbacks.forEach { $0(session) }
    }

    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        lastActivationError = error?.localizedDescription
        activationTimedOut = false
        drainActivationCallbacks(with: session)
    }

    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { session.activate() }

    public func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async { [weak self] in self?.handleAcknowledgement(applicationContext) }
    }

    public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any]) {
        DispatchQueue.main.async { [weak self] in self?.handleAcknowledgement(userInfo) }
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async { [weak self] in self?.handleAcknowledgement(message) }
    }
}
