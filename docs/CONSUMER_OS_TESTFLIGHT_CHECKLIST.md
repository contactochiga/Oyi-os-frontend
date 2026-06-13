# Consumer OS TestFlight Checklist

Last updated: 2026-06-13

## Pre-Archive Commands

Run from `/Users/ochigaidoko/Oyi-os-frontend`:

```bash
npm run build
npx tsc --noEmit --pretty false --incremental false
npm run lint
npx cap sync ios
npx cap sync android
git diff --check
```

## Native iOS Checks

- Open `ios/App/App.xcworkspace`.
- Confirm scheme: App.
- Confirm bundle id: `com.ochiga.oyios`.
- Confirm display name: `Oyi`.
- Confirm marketing version and build number.
- Confirm signing team and provisioning profile.
- Confirm Push Notifications capability.
- Confirm Background Modes: Remote notifications.
- Confirm camera, microphone, speech, photo and location usage strings.
- Confirm AppIcon and Splash assets render correctly.
- Confirm production API URL is intended for TestFlight.

## Physical iPhone Smoke

1. Fresh install.
2. Login.
3. Accept push notification permission.
4. Confirm APNs token is received.
5. Confirm backend token registration succeeds.
6. Switch between two homes/estates.
7. Confirm Home, Devices, Activity, Services and footer badges rehydrate for the selected home.
8. Open `/services` and verify utility linked/unlinked state matches backend registry.
9. Open `/ai`, send a long prompt, and confirm the final response remains above the composer.
10. Trigger an AI confirmation response and confirm buttons remain readable above the composer.
11. Open floating Oyi console and repeat a long response test.
12. Toggle a real simple switch from Consumer and confirm UI state refreshes.
13. Trigger a provider/Smart Life state update if available.
14. Open Community official notices and confirm read state persists.
15. Open Activity and confirm unread/attention state clears as expected.
16. Test Maintenance request creation.
17. Test Wallet/service payment flow in safe/non-production mode where applicable.
18. Confirm push notification delivery using backend test notification.

## TestFlight Upload Notes

- Do not upload if APNs entitlement/profile mismatch is present.
- Do not upload if `NEXT_PUBLIC_API_URL` points to a staging backend unintentionally.
- Do not upload if login, context switch, push registration, or Services registry fails on physical iPhone.
