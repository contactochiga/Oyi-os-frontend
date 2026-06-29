# Consumer Deployment Checklist

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run validate:release`
- Confirm auth/session flow against backend.
- Confirm home, devices, notifications, and chat entrypoints load after deploy.
