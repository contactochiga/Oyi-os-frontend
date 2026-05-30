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
            call.resolve(self.statusPayload(session: activatedSession, synced: false))
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
            session.sendMessage(payload, replyHandler: nil) { [weak self] error in
                DispatchQueue.main.async {
                    self?.lastSyncError = error.localizedDescription
                }
            }
        }

        var result = statusPayload(session: session, synced: usedApplicationContext || usedTransferUserInfo || usedSendMessage)
        result["usedApplicationContext"] = usedApplicationContext
        result["usedTransferUserInfo"] = usedTransferUserInfo
        result["usedSendMessage"] = usedSendMessage
        result["error"] = syncError as Any
        result["lastSyncError"] = lastSyncError as Any
        return result
    }

    private func statusPayload(session: WCSession, synced: Bool) -> [String: Any] {
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
            "synced": synced
        ]
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
}
