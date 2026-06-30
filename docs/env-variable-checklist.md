# Consumer Environment Variable Checklist

## Required client runtime

- `NEXT_PUBLIC_API_URL`: Consumer API base URL.
- `NEXT_PUBLIC_SOCKET_URL`: Socket or realtime endpoint when separated from the API origin.

## Optional client runtime

- Any public analytics keys intended for browser exposure.
- Any public AI feature keys intended for client exposure.
- Push configuration values only when the current native build path requires them.

## Native build assumptions

- Consumer uses a bundled Capacitor shell with `webDir=out`.
- Auth/session persistence must remain compatible with Capacitor Preferences and existing native session handling.
- Backend/runtime environment should match both `NEXT_PUBLIC_API_URL` and any socket/realtime origin.

## Pre-sync checklist

- Confirm API and socket URLs point to the intended backend.
- Confirm auth redirect or callback behavior remains valid for the native app.
- Confirm push, deep link, and native permission settings match the target test environment.
