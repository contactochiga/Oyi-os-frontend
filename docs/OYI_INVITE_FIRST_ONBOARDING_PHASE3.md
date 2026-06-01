# Oyi Invite-First Onboarding Phase 3

## Consumer flow

Unauthenticated residents now start from the invite-first entry:

1. Oyi cinematic preparation state.
2. Scan invitation, paste setup link, or sign in to an existing account.
3. Validate the secure invite through `POST /auth/invites/validate`.
4. Review the safe estate, home, role, and expiry preview.
5. Choose a username and password.
6. Activate through `POST /auth/invites/activate`.
7. Persist the returned JWT using the same Consumer session engine as login.
8. Fetch `/me/context`.
9. Complete or skip the local-first guided tour.
10. Enter `/home`.

Public signup remains available as a secondary development entry until the
production rollout explicitly disables it.

## Accepted invite inputs

The Consumer activation page extracts tokens from:

- `oyi://invite/<token>`
- `https://app.oyi.com/invite/<token>`
- `/auth/invite?token=<token>`
- raw token text

Facility-generated links currently use `/auth/invite?token=<token>`.

## Native QR scanner setup

The current Phase 3 UI includes the safe paste/manual fallback. A native barcode
scanner dependency is not installed in this repository yet, so camera denial or
scanner absence never blocks activation.

Recommended native follow-up:

```bash
npm install @capacitor-mlkit/barcode-scanning
npx cap sync ios
npx cap sync android
```

Then wire scanner launch from `/auth/invite?mode=scan`, request camera
permission at interaction time, extract the scanned payload with
`extractInviteToken()`, and keep the existing paste fallback.

## Native deep links

Deep-link transport is documented but not enabled by this phase.

### iOS

Add:

- `CFBundleURLTypes` URL scheme for `oyi`
- Associated Domains capability for `applinks:app.oyi.com`
- An Apple App Site Association file hosted at
  `https://app.oyi.com/.well-known/apple-app-site-association`
- Capacitor app URL listener routing invite links into
  `/auth/invite?token=<token>`

### Android

Add:

- Intent filter for `oyi://invite/<token>`
- Verified App Link intent filter for `https://app.oyi.com/invite/<token>`
- `assetlinks.json` hosted at
  `https://app.oyi.com/.well-known/assetlinks.json`
- Capacitor app URL listener routing invite links into
  `/auth/invite?token=<token>`

## Tour persistence

The guided tour currently persists locally:

- `oyi_onboarding_tour_pending`
- `oyi_onboarding_tour_complete`

The tour is replayable from `Profile -> Help & Support -> Replay Home Tour`.

Backend follow-up contract:

```http
PATCH /me/onboarding-tour
Content-Type: application/json

{
  "completed": true
}
```

Add a matching profile field such as `users.onboarding_tour_completed_at` before
server-side cross-device tour synchronization is enabled.
