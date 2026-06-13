# Consumer OS Release Candidate

Last updated: 2026-06-13
Repository: `/Users/ochigaidoko/Oyi-os-frontend`

## RC Status

Consumer OS is release-candidate ready for TestFlight handoff after operational smoke testing on a physical iPhone.

Readiness score: 94%

## Scope Frozen For RC

The release candidate keeps the approved Oyi dark glass visual system and the current navigation architecture.

Frozen resident surfaces:

- Home
- Spaces
- Devices
- Community
- Activity
- Visitors
- Wallet
- Maintenance
- Services
- Profile
- Oyi Intelligence
- Notifications
- Watch companion surface
- Proximity awareness settings
- Service registry bridge
- Push notification registration

## Backend Dependencies

Production API URL currently configured through `NEXT_PUBLIC_API_URL`:

- `https://oyi-os.onrender.com`

Critical backend dependencies:

- Authentication and `/me/context`
- Home/estate memberships
- Device estate routes and live socket events
- Activity feed and notifications
- Community posts and read state
- Visitors, wallet, maintenance, services
- `/services/home-registry`
- `/ai/chat` and confirmation routes
- Push registration endpoint
- Proximity settings/events
- Camera playback contracts where available

## Release Blockers

No code-level blocker was found in this pass.

Operational validation still required before public rollout:

- Physical iPhone APNs registration against the intended environment.
- Xcode archive signing with the final provisioning profile.
- Multi-home context switch smoke test with live backend data.
- Service registry validation for estates with and without linked utility accounts.
- Device live-state validation using real Tuya/provider events.

## Non-Blocking Warnings

- ESLint currently reports existing warnings, mostly hook dependency warnings, unused variables, and `<img>` usage warnings. No lint errors were reported.
- Some camera and provider features depend on backend/edge deployment readiness.
- App Store archive should confirm production APNs entitlement/profile, because the checked-in entitlement currently shows `aps-environment` as `development`.

## iOS Archive Readiness

Current native app configuration:

- App name: `Oyi`
- Bundle id: `com.ochiga.oyios`
- Marketing version: `1.0`
- Build number: `50`
- Capacitor web output: `out`
- Push plugin: `@capacitor/push-notifications@6.0.5`
- Device plugin: `@capacitor/device@6.0.3`
- Local notifications plugin: `@capacitor/local-notifications@6.1.3`
- Haptics plugin: `@capacitor/haptics@6.0.3`

Required iOS permissions present:

- Camera
- Microphone
- Speech recognition
- Photo library
- Photo library add
- Location when in use
- Background remote notifications
- Background fetch/location/processing

## Archive Checklist

1. Confirm `.env.local` points to the production backend intended for TestFlight.
2. Run `npm run build`.
3. Run `npx tsc --noEmit --pretty false --incremental false`.
4. Run `npm run lint` and confirm no errors.
5. Run `npx cap sync ios`.
6. Open `ios/App/App.xcworkspace` in Xcode.
7. Confirm signing team and provisioning profile.
8. Confirm Push Notifications and Background Modes are enabled.
9. Confirm APNs entitlement is production for App Store/TestFlight archive.
10. Archive from Xcode and validate before upload.

## Freeze Notes

- Do not introduce new UI patterns during RC.
- Do not alter backend contracts during RC unless an operational blocker is confirmed.
- All further RC changes should be bug fixes, permission fixes, release docs, or native archive adjustments.
