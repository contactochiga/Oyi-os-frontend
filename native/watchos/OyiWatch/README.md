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

The watch bundle must stay prefixed by the parent app bundle ID. If the production iPhone bundle ID changes, update both the watch bundle ID and `WKCompanionAppBundleIdentifier` before App Store submission.

## Run on Apple Watch Simulator

1. Open `OyiWatch.xcodeproj` in Xcode.
2. Select the `OyiWatch` scheme.
3. Choose an Apple Watch simulator such as `Apple Watch Series 9`.
4. Press `Cmd + R`.

The app is simulator-safe. If no backend URL/token is configured, it runs in `Mock mode` and all UI states can still be tested:

- `Talk` moves through Listening -> Working -> Success.
- `Alert` shows the alert state.
- `More` opens quick actions.
- Quick actions update state.
- Medium-risk actions open Confirmation.
- `Confirm` completes pending commands.
- `Cancel` cancels pending commands.

If no Apple Watch simulator appears:

1. Open Xcode `Settings` -> `Platforms`.
2. Install the watchOS simulator runtime.
3. Try the destination picker again.

## Backend command test

The watch app connects to these authenticated backend endpoints when a backend URL and bearer token are available:

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

The Oyi Home iPhone app now includes an iOS native Capacitor plugin:

```text
ios/App/App/OyiWatchSyncPlugin.swift
```

The web layer calls it through:

```text
src/services/watchSyncService.ts
```

Session handoff happens in two ways:

1. Automatic sync after login/session restore when an auth token and user context are available.
2. Manual sync from Oyi Home Settings -> Connected Systems -> Oyi Watch -> Sync Watch.

The iPhone sends only safe runtime context:

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

Raw tokens are never logged by the sender. The watch receives application context or direct messages, stores the backend URL/token in Keychain, and uses them for the watch adapter calls.

## Manual Sync Watch test

1. Run Oyi Home on an iPhone simulator or real iPhone.
2. Log in with a valid user.
3. Open Settings.
4. Use `Sync Watch` in the Oyi Watch card.
5. On paired watch hardware, open Oyi Watch and trigger `Talk` or a quick action.
6. Confirm backend calls reach the watch endpoints with the authenticated bearer token.

Simulator-only testing can still use mock mode if the iPhone/watch pair is not available.

## Run on a real Apple Watch Series 9

1. Pair the Apple Watch with your iPhone.
2. Keep the watch unlocked and near the iPhone/Mac.
3. Connect the iPhone to the Mac.
4. In Xcode, sign the parent iOS app and watch target with your Apple Developer Team.
5. Confirm the parent app bundle is `com.ochiga.oyios`.
6. Confirm the watch bundle is `com.ochiga.oyios.watch`.
7. Select the paired Apple Watch destination.
8. Press `Cmd + R`.

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

- Home Awareness
- Listening
- Working / Executing
- Confirmation
- Success
- Alert
- Quick Actions

## Remaining blockers

- Add final App Store watch icons to `Assets.xcassets/AppIcon.appiconset`.
- Set Apple Developer Team in Xcode signing settings for real device install.
- Validate WatchConnectivity handoff on a real paired iPhone + Apple Watch.
- Configure APNs/watch notification categories for production visitor/security/environment alerts.

## Local iOS dev build flow for Watch sync

Use this flow before App Store release when you need the logged-in Oyi Home iPhone app to hand the backend URL and bearer token to the paired Apple Watch.

From the Consumer repo:

```bash
cd /Users/ochigaidoko/Oyi-os-frontend
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

In Xcode:

1. Select the `App` scheme, not the standalone watch project.
2. Select your connected iPhone as the run destination.
3. Open `Signing & Capabilities` for the iPhone app target.
4. Set your Apple Developer Team.
5. Confirm the iPhone bundle ID is `com.ochiga.oyios`.
6. Press `Cmd + R` to install Oyi Home on the connected iPhone.
7. Log in on the iPhone app.
8. Open Settings -> Connected Systems -> Oyi Watch.
9. Tap `Sync Watch`.
10. Open Oyi Watch on the paired Apple Watch.
11. Trigger `Talk` or a quick action to verify the watch uses the synced backend session.

Expected behavior:

- On native iPhone, `Sync Watch` sends the backend URL and bearer token through WatchConnectivity.
- On web or non-iOS environments, Settings shows: `Watch sync requires the iPhone app. Please open Oyi Home on iPhone.`
- The watch stores received values in Keychain.
- No raw token is printed to logs.

Useful verification commands:

```bash
npm run build
npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
xcodebuild -project native/watchos/OyiWatch/OyiWatch.xcodeproj -scheme OyiWatch -sdk watchsimulator -destination 'generic/platform=watchOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

## Integrated companion target in main iOS workspace

Oyi Watch is now also registered as a watchOS companion target inside the main Capacitor iOS workspace:

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

Integrated Xcode run steps:

1. Run the web/native sync first:

```bash
cd /Users/ochigaidoko/Oyi-os-frontend
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

2. In Xcode, select the `App` scheme.
3. Select your connected iPhone as the destination.
4. Set Signing & Capabilities for both `App` and `OyiWatch` targets to the same Apple Developer Team.
5. Confirm the parent iPhone target uses `com.ochiga.oyios`.
6. Confirm the watch target uses `com.ochiga.oyios.watch`.
7. Press `Cmd + R`.
8. Xcode should install the iPhone app and embed/install the companion Oyi Watch app on the paired watch.
9. Open Oyi Home on iPhone and log in.
10. Go to Settings -> Connected Systems -> Oyi Watch -> `Sync Watch`.
11. Open Oyi Watch on the paired Apple Watch and run `Talk` or a quick action.

Verification commands for the integrated workspace:

```bash
xcodebuild -workspace ios/App/App.xcworkspace -list
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
xcodebuild -workspace ios/App/App.xcworkspace -scheme OyiWatch -sdk watchsimulator -destination 'generic/platform=watchOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

## Phase 2 sync acknowledgement

`Sync Watch` is a delivery request, not proof that the watch is live. The iPhone now reports `Connected` only after Oyi Watch:

1. Receives the secure session through WatchConnectivity.
2. Stores the backend URL and bearer token in Keychain.
3. Fetches `GET /watch/home-status` successfully.
4. Sends an acknowledgement back to the iPhone.

The acknowledgement and last successful backend timestamp are persisted locally. If the backend becomes unavailable after a successful sync, the watch shows `Offline` with the last sync time and pauses actions.

## Notification foundation

The native watch app registers watchOS notification categories for:

- `OYI_VISITOR_ALERT`
- `OYI_SECURITY_ALERT`
- `OYI_ENVIRONMENT_ALERT`
- `OYI_DEVICE_ALERT`

Opening one routes the watch into its alert state. Push delivery and server-side category assignment still require production APNs configuration.

## App icon assets and physical installation

`Assets.xcassets/AppIcon.appiconset` contains branded Watch artwork for notification, companion settings, launcher, quick-look, and App Store marketing variants. The build-50 physical parent bundle packages the compiled Watch `Assets.car`, provisioning profile, code signature, and executable under `App.app/Watch/OyiWatch.app`.

The remaining real-device installation blocker captured on May 31, 2026 is an Apple CoreDevice remote-pairing tunnel timeout, not a missing icon catalog or invalid embedded bundle:

```text
CoreDeviceError 4000
Timed out while attempting to establish tunnel using negotiated network parameters.
Ensure the device is accessible from this machine over an infrastructure network,
or ensure WiFi is enabled on both machines.
```

The temporary display name `Oyi Watch 50` should remain until the iPhone Watch listing proves it is reading the refreshed embedded metadata. Revert it to `Oyi Watch` after physical installation succeeds.
