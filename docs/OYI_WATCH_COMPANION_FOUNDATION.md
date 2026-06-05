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
- explicit session clearing on iPhone logout

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
Display name:                      Oyi
```

Build and version details remain available inside Diagnostics only.

## 4. Session Handoff And Clear

The iPhone native bridge lives at:

```text
ios/App/App/OyiWatchSyncPlugin.swift
src/services/watchSyncService.ts
```

After login, session restoration, or manual sync, the iPhone sends runtime context:

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

On iPhone logout, the plugin sends a clear-session payload. The Watch deletes backend URL and bearer token from Keychain, clears cached home/glance/action state, and shows `Sign in on iPhone`.

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

All Watch endpoints use the same Oyi bearer-token model, permissions, ledger, and audit flow as Consumer:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/watch/status` | Safe minimal Watch context/readiness |
| `GET` | `/watch/home-status` | Real scoped home state |
| `GET` | `/watch/glances` | Real watch-ready awareness feed |
| `GET` | `/watch/quick-actions` | Real permitted action list |
| `POST` | `/watch/command` | Send transcript or explicit action |
| `POST` | `/watch/confirm` | Confirm pending ledger action |
| `POST` | `/watch/cancel` | Cancel pending ledger action |

Safety rules:

- read surfaces require resident context and `devices.read`
- command, confirm, and cancel require `devices.control`
- explicit device IDs are re-scoped to the active home and estate
- cross-home commands fail closed
- low-risk actions may execute immediately
- medium-risk actions require confirmation
- unsupported high-risk actions remain denied
- provider errors, queued state, offline state, and permission denial remain honest

## 7. Native UI States

Production SwiftUI states:

- signed out
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

The app uses geometry-based adaptive sizing for modern Apple Watch display sizes and no longer depends on mock chrome or fake navigation dots.

## 8. Notifications Foundation

The native Watch app registers:

```text
OYI_VISITOR_ALERT
OYI_SECURITY_ALERT
OYI_ENVIRONMENT_ALERT
OYI_DEVICE_ALERT
```

Notification taps route into the relevant Watch alert state. Backend APNs delivery now attaches `aps.category` for these Watch categories when notification type/metadata maps safely to a supported Watch alert category. Notification action buttons remain deferred until backend action contracts exist.

## 9. Icon Catalog

`native/watchos/OyiWatch/Assets.xcassets/AppIcon.appiconset` contains branded image files for notification, companion settings, launcher, quick-look, and marketing slots.

The physical/iOS build packages:

```text
App.app/Watch/OyiWatch.app/Assets.car
App.app/Watch/OyiWatch.app/embedded.mobileprovision
App.app/Watch/OyiWatch.app/_CodeSignature
App.app/Watch/OyiWatch.app/OyiWatch
```

## 10. Physical Smoke Checklist

1. Put Mac, iPhone, and Watch on a normal Wi-Fi network.
2. Keep Watch unlocked, near iPhone, and preferably charging.
3. Open `ios/App/App.xcworkspace`.
4. Select the `App` scheme.
5. Confirm parent bundle ID `com.ochiga.oyios`.
6. Confirm Watch bundle ID `com.ochiga.oyios.watch`.
7. Confirm Watch display name `Oyi`.
8. Build and install to the connected iPhone.
9. Log in on iPhone.
10. Tap `Sync Watch` in Connected Systems.
11. Open Oyi on Watch and verify status/glances/actions.
12. Run a safe quick action and verify success/failure state.
13. Log out on iPhone and verify the Watch returns to signed-out state.
14. Send visitor/security/environment/device notifications and verify Watch alert presentation.

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
| Native watchOS package | Complete foundation |
| Embedded iPhone companion relationship | Complete |
| Icon catalog and packaged assets | Complete |
| WatchConnectivity session handoff | Complete |
| Logout/session clear | Complete foundation |
| Truthful acknowledgement model | Complete foundation |
| Watch adapter API | Complete foundation |
| Quick actions | Real and limited |
| Notification categories | Registered and backend-category aware |
| Simulator build | Passing |
| Physical Apple Watch install | Requires final physical smoke |
| Wear OS | Foundation only |
