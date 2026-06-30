# Consumer Deployment Checklist

## Validation

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run validate:release`
- `git diff --check`

## Native sync readiness

- Confirm the intended backend API and socket URLs are configured.
- Run `npm run cap:sync:ios`.
- Run `npm run cap:sync:android`.
- Confirm generated native assets and config stay aligned with the existing bundle ID and native entitlements.

## Physical-device smoke

- Login and logout.
- Verify session persistence after relaunch.
- Open Devices, Activity, Visitors, Wallet, Notifications, and AI.
- Verify keyboard, safe area, bottom navigation, and push permission flows.
