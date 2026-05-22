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

- `Talk` moves through Listening → Working → Success.
- `Alert` shows the alert state.
- `More` opens quick actions.
- Quick actions update state.
- Medium-risk actions open Confirmation.
- `Confirm` completes pending commands.
- `Cancel` cancels pending commands.

If no Apple Watch simulator appears:

1. Open Xcode `Settings` → `Platforms`.
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

## WatchConnectivity token handoff

Production auth should come from the logged-in Oyi Home iPhone app using WatchConnectivity.

The watch app already listens for application context or direct messages with these keys:

```json
{
  "baseURL": "https://your-backend.example.com",
  "bearerToken": "user-session-token"
}
```

or:

```json
{
  "backendBaseURL": "https://your-backend.example.com",
  "authToken": "user-session-token"
}
```

The watch stores received values in Keychain and uses them for backend calls. The iPhone app still needs to send this payload after login/session refresh.

## Run on a real Apple Watch Series 9

1. Pair the Apple Watch with your iPhone.
2. Keep the watch unlocked and near the iPhone/Mac.
3. Connect the iPhone to the Mac.
4. In Xcode, sign the target with your Apple Developer Team.
5. Confirm the parent app bundle is `com.ochiga.oyios`.
6. Confirm the watch bundle is `com.ochiga.oyios.watch`.
7. Select the paired Apple Watch destination.
8. Press `Cmd + R`.

## Remaining blockers

- Add real app icons to `Assets.xcassets/AppIcon.appiconset`.
- Set Apple Developer Team in Xcode signing settings for real device install.
- Add the iPhone-side WatchConnectivity sender in the iOS app after login.
- Configure APNs/watch notification categories for production alerts.
