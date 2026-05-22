import Foundation
import Capacitor
import WatchConnectivity

@objc(OyiWatchSyncPlugin)
public class OyiWatchSyncPlugin: CAPPlugin, CAPBridgedPlugin, WCSessionDelegate {
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
        guard let session else {
            call.resolve(["available": false, "synced": false, "reason": "watch_connectivity_unavailable"])
            return
        }

        activateSessionIfNeeded()

        guard let backendBaseURL = call.getString("backendBaseURL"), !backendBaseURL.isEmpty,
              let bearerToken = call.getString("bearerToken"), !bearerToken.isEmpty else {
            call.reject("backendBaseURL and bearerToken are required")
            return
        }

        var payload: [String: Any] = [
            "backendBaseURL": backendBaseURL,
            "baseURL": backendBaseURL,
            "bearerToken": bearerToken,
            "authToken": bearerToken,
            "sentAt": ISO8601DateFormatter().string(from: Date())
        ]

        if let userId = call.getString("userId"), !userId.isEmpty { payload["userId"] = userId }
        if let homeId = call.getString("homeId"), !homeId.isEmpty { payload["homeId"] = homeId }
        if let estateId = call.getString("estateId"), !estateId.isEmpty { payload["estateId"] = estateId }
        if let role = call.getString("role"), !role.isEmpty { payload["role"] = role }

        do {
            try session.updateApplicationContext(payload)
            if session.isReachable {
                session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
            }
            call.resolve([
                "available": true,
                "paired": session.isPaired,
                "watchAppInstalled": session.isWatchAppInstalled,
                "reachable": session.isReachable,
                "synced": true
            ])
        } catch {
            call.reject("watch_sync_failed", error.localizedDescription, error)
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        guard let session else {
            call.resolve(["available": false, "reason": "watch_connectivity_unavailable"])
            return
        }
        activateSessionIfNeeded()
        call.resolve([
            "available": true,
            "paired": session.isPaired,
            "watchAppInstalled": session.isWatchAppInstalled,
            "reachable": session.isReachable,
            "activationState": session.activationState.rawValue
        ])
    }

    private func activateSessionIfNeeded() {
        guard let session else { return }
        if session.delegate !== self {
            session.delegate = self
        }
        if session.activationState == .notActivated {
            session.activate()
        }
    }

    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
