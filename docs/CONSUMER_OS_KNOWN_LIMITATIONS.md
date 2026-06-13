# Consumer OS Known Limitations

Last updated: 2026-06-13

## Operational Validation Required

- Real device live-state depends on the provider/Tuya event stream and backend socket delivery.
- Physical wall-switch state changes require provider reporting; Oyi must not infer physical source unless the provider proves it.
- Service payments may enter pending/manual-review provider states when no real provider fulfillment exists.
- Camera playback depends on the backend camera core and Oyi Edge/go2rtc runtime being deployed on the same network as private DVR/NVR sources.
- Watch companion should be smoked on a physical Apple Watch before being marketed as production-ready.

## iOS Release Notes

- The checked-in entitlement currently declares `aps-environment` as `development`; production archive must use the correct App Store/TestFlight provisioning profile.
- Background location/proximity behavior requires clear user opt-in and physical-device testing.
- Push notification behavior should be tested after fresh install and after logout/login.

## UI / Code Warnings

- ESLint reports warnings in existing modules, mostly hook dependency warnings, unused variables, and `<img>` usage warnings. These are non-blocking for RC because no lint errors are present.
- Some utility/security/reporting surfaces are beta-level and should be treated as secondary surfaces in release messaging.

## Data and Context Risks

- One account can belong to multiple estates/homes. All scoped modules must continue to use active `estate_id` and `home_id` rather than stale user-row defaults.
- Service registry linkage must be validated per estate/home because some homes intentionally have no utility identifiers yet.
- Activity, notification and badge state must remain context-scoped during home switching.

## Release Guardrails

- No new design language during RC.
- No fake service, camera, device or payment state.
- No unsupported device controls.
- No noisy production debug logs.
- No backend contract changes without a confirmed release blocker.
