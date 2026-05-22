# Oyi Watch OS Companion Foundation

This is the native smartwatch companion foundation for Oyi Home. The existing `/watch` web route is a concept preview only and must not be treated as the production watch app.

## Backend endpoints

All endpoints require the same Oyi Home bearer token/session model:

- `GET /watch/home-status`
- `GET /watch/glances`
- `GET /watch/quick-actions`
- `POST /watch/command`
- `POST /watch/confirm`
- `POST /watch/cancel`

The watch adapter reuses:

- authenticated user identity
- role/permission scope
- Oyi AI command router
- device command worker
- AI execution ledger
- audit events
- notification/activity records

## watchOS structure

Foundation files live at:

- `native/watchos/OyiWatch/OyiWatchApp.swift`

Recommended Xcode integration:

1. Open the existing iOS Capacitor project in `ios/App`.
2. Add a new watchOS App target named `OyiWatch`.
3. Add `native/watchos/OyiWatch/OyiWatchApp.swift` to the watch target.
4. Enable WatchConnectivity in the iOS app and watch extension.
5. After Oyi Home login, send the backend base URL and short-lived bearer token to the watch using `WCSession`.
6. Never store raw credentials in the watch bundle.

## Wear OS structure

Foundation files live at:

- `native/wearos/OyiWear/app/src/main/java/com/oyi/watch/OyiWearMainActivity.kt`

Recommended Android integration:

1. Add an Android project or Wear module once the Android native project is checked into this repo.
2. Create a Wear OS app module named `OyiWear`.
3. Add the Kotlin Compose activity file above.
4. Use the Data Layer API or encrypted local storage to receive a short-lived Oyi Home token from the phone.
5. Call the `/watch/*` backend adapter endpoints with `Authorization: Bearer <token>`.

## UX rules

The watch is not a phone UI.

- orb-first
- voice-first
- glance-first
- confirmation-focused
- no bottom nav
- no dashboards
- no dense menus

## Command strategy

Low-risk actions:

- lights on/off
- simple scenes
- fan/climate status
- show home status

Medium-risk actions:

- arm security
- gates
- locks
- visitor/access flows

High-risk actions remain disabled or require admin approval:

- wallet debit
- permission changes
- estate lockdown
- camera disable
- admin mutations

## Notification strategy

Watch glances should come from:

- `/watch/glances`
- push notification payloads
- activity/notification records
- future realtime bridge where available

Payload tone should be calm and concise:

- `Visitor at gate`
- `Package delivered`
- `Power restored`
- `Room 2 AC turned off`

## Remaining blockers

- Xcode target must be created inside the local iOS project manually because `.xcodeproj` target mutation is safer inside Xcode.
- Android native project is not currently checked in, so Wear OS is provided as a Compose module foundation.
- Watch token handoff needs WatchConnectivity/Data Layer implementation in the phone app.
- Production push notification categories need APNs/FCM watch companion configuration.
