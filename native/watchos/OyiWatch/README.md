# Oyi Watch

Runnable native watchOS SwiftUI project for the Oyi Home companion watch app foundation.

This is a real Xcode project, not the `/watch` web concept page.

## Open in Xcode

Open this file:

```text
/Users/ochigaidoko/Oyi-os-frontend/native/watchos/OyiWatch/OyiWatch.xcodeproj
```

You can open it from Terminal:

```bash
open /Users/ochigaidoko/Oyi-os-frontend/native/watchos/OyiWatch/OyiWatch.xcodeproj
```

## Bundle identifiers

Parent iOS app bundle ID:

```text
com.ochiga.oyios
```

Watch app bundle ID:

```text
com.ochiga.oyios.watch
```

Info.plist companion key:

```text
WKCompanionAppBundleIdentifier = com.ochiga.oyios
```

The installed Apple Watch display name is `Oyi`. Build and version numbers remain visible only inside Diagnostics.

## Current capability

Oyi Watch is a truthful companion foundation. It supports:

- secure iPhone-to-Watch session handoff
- signed-in/signed-out state
- home status
- glances
- backend-provided quick actions
- confirmation for pending ledger actions
- notification alert presentation
- diagnostics
- calm offline states

It does not yet provide full AC/TV/IR remotes, full device browsing, complications, or Watch-native visitor approval.

## Run on Apple Watch Simulator

1. Open `OyiWatch.xcodeproj` in Xcode.
2. Select the `OyiWatch` scheme.
3. Choose an Apple Watch simulator such as `Apple Watch Series 9`.
4. Press `Cmd + R`.

If no backend URL/token is configured, production builds show the signed-out empty state: `Open Oyi on your iPhone to sync your home.` Preview fixtures are available only for explicit debug/development testing and must not be used as production data.

If no Apple Watch simulator appears:

1. Open Xcode `Settings` -> `Platforms`.
2. Install the watchOS simulator runtime.
3. Try the destination picker again.

## Backend command test

The watch app connects to these authenticated backend endpoints when a backend URL and bearer token are available:

- `GET /watch/status`
- `GET /watch/home-status`
- `GET /watch/glances`
- `GET /watch/quick-actions`
- `POST /watch/command`
- `POST /watch/confirm`
- `POST /watch/cancel`

For temporary simulator testing, set scheme environment variables in Xcode:

```text
OYI_WATCH_BACKEND_URL=https://your-backend.example.com
OYI_WATCH_DEV_TOKEN=replace-with-temporary-dev-token
```

Do not commit real tokens. The committed source contains no real token.

## WatchConnectivity session handoff

The Oyi Home iPhone app includes an iOS native Capacitor plugin:

```text
ios/App/App/OyiWatchSyncPlugin.swift
```

The web layer calls it through:

```text
src/services/watchSyncService.ts
```

Session handoff happens in three ways:

1. Automatic sync after login/session restore when an auth token and user context are available.
2. Manual sync from Oyi Home Settings -> Connected Systems -> Oyi Watch -> Sync Watch.
3. Explicit session clear on iPhone logout.

The iPhone sends only runtime context needed by the Watch:

```json
{
  "backendBaseURL": "https://your-backend.example.com",
  "bearerToken": "user-session-token",
  "userId": "user-id",
  "homeId": "home-id",
  "estateId": "estate-id",
  "role": "resident"
}
```

Raw tokens are never logged by the sender. The Watch receives application context or direct messages, stores the backend URL/token in Keychain, and uses them for authenticated Watch adapter calls. Logout sends a clear-session payload that deletes the Watch Keychain session and clears cached glances/actions.

## Manual Sync Watch test

1. Run Oyi Home on an iPhone simulator or real iPhone.
2. Log in with a valid user.
3. Open Settings -> Connected Systems.
4. Use `Sync Watch` in the Oyi Watch card.
5. On paired watch hardware, open Oyi Watch and trigger `Talk` or a quick action.
6. Confirm backend calls reach the watch endpoints with the authenticated bearer token.
7. Log out from iPhone and confirm the Watch returns to `Sign in on iPhone`.

## Physical smoke checklist

1. Pair Apple Watch with iPhone.
2. Keep Watch unlocked and near iPhone.
3. Connect iPhone to Mac.
4. Open `ios/App/App.xcworkspace`.
5. Select the `App` scheme.
6. Set Signing & Capabilities for `App` and `OyiWatch` targets to the same Apple Developer Team.
7. Confirm parent app bundle ID is `com.ochiga.oyios`.
8. Confirm Watch bundle ID is `com.ochiga.oyios.watch`.
9. Build/install the iPhone app.
10. Confirm Watch app listing/display name is `Oyi`.
11. Log in on iPhone and tap `Sync Watch`.
12. Confirm Watch status, glances, and quick actions load from backend.
13. Confirm logout clears the Watch session.
14. Confirm visitor/security/environment/device notification categories enter the Watch alert state.

## Visual direction

The native SwiftUI UI follows the approved Oyi Watch direction:

- orb-first
- dark ambient surface
- soft Oyi blue glow
- compact glance states
- voice-first interaction
- confirmation-focused risky actions
- no dashboard UI
- no bottom navigation

Implemented watch states:

- signed out
- connecting
- home awareness
- glances
- listening
- working / executing
- confirmation
- success
- alert
- failed
- offline with last sync
- diagnostics

## Remaining limitations

- Real AC/TV/IR remotes are intentionally not implemented yet.
- Visitor approve/deny from Watch requires a backend action contract.
- Notification action buttons are not enabled yet.
- Complications are not implemented yet.
- Full physical notification smoke still requires production APNs credentials and a paired device.

## Local iOS dev build flow for Watch sync

Use this flow before App Store release when you need the logged-in Oyi Home iPhone app to hand the backend URL and bearer token to the paired Apple Watch.

From the Consumer repo:

```bash
cd /Users/ochigaidoko/Oyi-os-frontend
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

Expected behavior:

- On native iPhone, `Sync Watch` sends the backend URL and bearer token through WatchConnectivity.
- On web or non-iOS environments, Watch sync reports that it requires the iPhone app.
- The Watch stores received values in Keychain.
- Logging out clears the Watch Keychain session where WatchConnectivity delivery reaches the Watch.
- No raw token is printed to logs.

Useful verification commands:

```bash
npm run build
npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
xcodebuild -project native/watchos/OyiWatch/OyiWatch.xcodeproj -scheme OyiWatch -sdk watchsimulator -destination 'generic/platform=watchOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

## Integrated companion target in main iOS workspace

Oyi Watch is registered as a watchOS companion target inside the main Capacitor iOS workspace:

```text
/Users/ochigaidoko/Oyi-os-frontend/ios/App/App.xcworkspace
```

The main iPhone `App` target embeds:

```text
App.app/Watch/OyiWatch.app
```

Use this integrated target for real iPhone + Apple Watch testing. The standalone project remains useful for isolated watch simulator UI work, but the main workspace is the production-style install path.

Integrated bundle relationship:

```text
Parent iOS bundle ID: com.ochiga.oyios
Watch bundle ID: com.ochiga.oyios.watch
WKCompanionAppBundleIdentifier: com.ochiga.oyios
```

## Notification foundation

The native Watch app registers watchOS notification categories for:

- `OYI_VISITOR_ALERT`
- `OYI_SECURITY_ALERT`
- `OYI_ENVIRONMENT_ALERT`
- `OYI_DEVICE_ALERT`

Backend APNs payloads now attach those categories when notification type/metadata maps safely to visitor, security, environment, or device alerts. Notification action buttons remain deferred until explicit backend action contracts are available.
