# Oyi Watch Companion - Production Handoff

## 1. Product Boundary

Oyi Watch is the native, orb-first smartwatch companion for Oyi Home. It is not the `/watch` web concept preview and it does not replicate the phone dashboard.

Core behavior:

- glance-first awareness
- voice-first commands
- permission-aware quick actions
- confirmation for sensitive actions
- calm offline and stale-state handling
- secure iPhone-to-Watch session handoff

The `/watch` Consumer route remains a labeled development/reference preview only.

## 2. Native Projects

Production install path:

```text
ios/App/App.xcworkspace
  App target
    -> Embed Watch Content
      -> App.app/Watch/OyiWatch.app
```

Shared watch source:

```text
native/watchos/OyiWatch/OyiWatchApp.swift
native/watchos/OyiWatch/Info.plist
native/watchos/OyiWatch/Assets.xcassets
```

The standalone project remains available for isolated simulator UI testing:

```text
native/watchos/OyiWatch/OyiWatch.xcodeproj
```

Both the integrated target and standalone project reference the same SwiftUI source and icon catalog.

## 3. Bundle Relationship

```text
Parent iOS app:                    com.ochiga.oyios
Watch app:                         com.ochiga.oyios.watch
WKCompanionAppBundleIdentifier:    com.ochiga.oyios
WKRunsIndependentlyOfCompanionApp: false
```

The parent App and embedded Watch target use the same Apple Developer Team:

```text
WK3GZ22BSG
```

## 4. Session Handoff

The iPhone native bridge lives at:

```text
ios/App/App/OyiWatchSyncPlugin.swift
src/services/watchSyncService.ts
```

After login, session restoration, or manual Profile sync, the iPhone sends safe session context:

```json
{
  "backendBaseURL": "https://oyi-os.onrender.com",
  "bearerToken": "<JWT>",
  "userId": "<USER_ID>",
  "homeId": "<HOME_ID>",
  "estateId": "<ESTATE_ID>",
  "role": "resident"
}
```

The token is never logged. The plugin activates `WCSession` before sync and uses:

- `updateApplicationContext` for durable latest state
- `transferUserInfo` as queued delivery fallback
- `sendMessage` for immediate delivery when reachable

## 5. Truthful Acknowledgement Model

Submitting a payload is not treated as proof that the Watch is live.

The Watch reports acknowledgement only after:

1. receiving the payload
2. storing backend URL and bearer token in Keychain
3. fetching `GET /watch/home-status` successfully
4. updating local Watch state
5. sending acknowledgement to the iPhone

Persisted diagnostics include:

- last session sync
- last successful backend fetch
- last acknowledgement
- last error summary
- WatchConnectivity state

Resident-facing status distinguishes:

```text
Not Connected
Sync Queued
Sync Sent
Waiting for Watch
Connected
Offline / Last synced <time>
Sync Failed
```

## 6. Backend Watch Adapter

All Watch endpoints use the same Oyi bearer-token model, device command path, permissions, ledger, and audit flow as Consumer:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/watch/home-status` | Real scoped home state |
| `GET` | `/watch/glances` | Real watch-ready awareness feed |
| `GET` | `/watch/quick-actions` | Real permitted action list |
| `POST` | `/watch/command` | Send transcript or explicit action |
| `POST` | `/watch/confirm` | Confirm pending ledger action |
| `POST` | `/watch/cancel` | Cancel pending ledger action |

Safety rules:

- read surfaces require resident context and `devices.read`
- command execution requires `devices.control`
- explicit device IDs are re-scoped to the active home and estate
- cross-home commands fail closed
- low-risk actions may execute immediately
- medium-risk actions require confirmation
- unsupported high-risk actions remain denied
- provider errors, queued state, offline state, and permission denial remain honest

## 7. Native UI States

Production SwiftUI states:

- disconnected
- connecting
- awareness
- glances
- listening
- thinking
- executing
- confirmation
- success
- alert
- failed
- offline with last sync
- diagnostics

The app uses geometry-based adaptive sizing for modern Apple Watch display sizes and no longer depends on mock `9:41` chrome or fake navigation dots.

## 8. Notifications Foundation

The native Watch app registers:

```text
OYI_VISITOR_ALERT
OYI_SECURITY_ALERT
OYI_ENVIRONMENT_ALERT
OYI_DEVICE_ALERT
```

Notification taps route into the relevant Watch alert state. Production APNs validation and backend category assignment remain rollout checks.

## 9. Icon Catalog

`native/watchos/OyiWatch/Assets.xcassets/AppIcon.appiconset` contains real branded image files for notification, companion settings, launcher, quick-look, and marketing slots.

The physical-device build packages:

```text
App.app/Watch/OyiWatch.app/Assets.car
App.app/Watch/OyiWatch.app/embedded.mobileprovision
App.app/Watch/OyiWatch.app/_CodeSignature
App.app/Watch/OyiWatch.app/OyiWatch
```

## 10. Current Physical Install Blocker

On May 31, 2026, build `50` validated as an embedded physical Watch bundle. The paired Series 9 runs watchOS `26.6`, above the `10.0` deployment target. Developer Mode is enabled.

The unresolved physical installation issue is device transport, not bundle validation:

```text
CoreDeviceError 4000
Timed out while attempting to establish tunnel using negotiated network parameters.
Ensure the device is accessible from this machine over an infrastructure network,
or ensure WiFi is enabled on both machines.
```

The Watch CoreDevice record reported:

```text
pairingState: paired
transportType: localNetwork
tunnelState: disconnected
```

Recovery checklist:

1. Put Mac, iPhone, and Watch on the same normal Wi-Fi network.
2. Disable VPN, hotspot, and guest-network isolation temporarily.
3. Keep Watch unlocked, near iPhone, and preferably charging.
4. Delete Oyi Home from iPhone.
5. Reboot iPhone and Watch.
6. Reinstall the parent App scheme from `ios/App/App.xcworkspace`.
7. Open iPhone Watch app and install Oyi Watch.

The temporary display name `Oyi Watch 50` is intentionally retained until the physical listing proves it is reading the refreshed bundle. Revert it to `Oyi Watch` after confirmation.

## 11. Build Commands

```bash
cd /Users/ochigaidoko/Oyi-os-frontend
npm run build
npx cap sync ios

xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  build CODE_SIGNING_ALLOWED=NO

xcodebuild \
  -project native/watchos/OyiWatch/OyiWatch.xcodeproj \
  -scheme OyiWatch \
  -sdk watchsimulator \
  -destination 'generic/platform=watchOS Simulator' \
  build CODE_SIGNING_ALLOWED=NO
```

## 12. Wear OS Status

Wear OS remains a documented Android companion foundation under:

```text
native/wearos
```

It is not production-ready and must not be presented as equivalent to the native watchOS app until Android Data Layer session handoff, secure storage, UI completion, and physical-device tests are implemented.

## 13. Release Status

| Area | Status |
| --- | --- |
| Native watchOS package | Complete |
| Embedded iPhone companion relationship | Complete |
| Icon catalog and packaged assets | Complete |
| WatchConnectivity session handoff | Complete |
| Truthful acknowledgement model | Complete |
| Watch adapter API | Complete foundation |
| Simulator build | Passing |
| Physical Apple Watch install | Blocked by CoreDevice network tunnel |
| Wear OS | Foundation only |
