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

## Run on Apple Watch Simulator

1. Open `OyiWatch.xcodeproj` in Xcode.
2. Select the `OyiWatch` scheme.
3. In the run destination picker, choose an Apple Watch simulator such as `Apple Watch Series 9`.
4. Press `Cmd + R`.

If no Apple Watch simulator appears:

1. Open Xcode `Settings` → `Platforms`.
2. Install the watchOS simulator runtime.
3. Try the destination picker again.

## Run on a real Apple Watch Series 9

1. Pair the Apple Watch with your iPhone.
2. Connect the iPhone to the Mac.
3. In Xcode, sign the target with your Apple Developer Team.
4. Keep bundle id as placeholder or replace it:

```text
com.oyi.watch
```

5. Select the paired Apple Watch destination.
6. Press `Cmd + R`.

## Companion app bundle

The watch app declares its iPhone companion with:

```text
WKCompanionAppBundleIdentifier = com.ochiga.oyios
```

This value must match the production Oyi Home iPhone app bundle identifier before App Store submission. If the iOS app bundle changes, update `Info.plist` before archiving the watch app.

The watch app bundle identifier remains:

```text
com.oyi.watch
```

## Backend connection

The source currently contains placeholders for `baseURL` and `bearerToken` in `OyiWatchSession`.

Production token handoff should be implemented from the iOS Oyi Home app using WatchConnectivity after login. Do not hardcode tokens inside the watch app.

Watch-safe backend endpoints already added in the backend repo:

- `GET /watch/home-status`
- `GET /watch/glances`
- `GET /watch/quick-actions`
- `POST /watch/command`
- `POST /watch/confirm`
- `POST /watch/cancel`

## Remaining blockers

- Add real app icons to `Assets.xcassets/AppIcon.appiconset`.
- Set Apple Developer Team in Xcode signing settings.
- Implement WatchConnectivity token/session handoff from the iOS app.
- Configure APNs/watch notification categories for production alerts.
