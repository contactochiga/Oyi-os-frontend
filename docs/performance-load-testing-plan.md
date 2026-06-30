# Consumer Performance and Load Testing Plan

## Web and WebView performance

- Run Lighthouse on the bundled web build for mobile baselines.
- Measure cold start, first interactive screen, AI open latency, and device-detail open latency on real devices.

## Runtime and network checks

- Measure realtime reconnect time after airplane-mode recovery.
- Measure device-command latency from tap to reflected state.
- Verify long AI responses do not cause scroll jumps or composer overlap.

## Backend dependency load plan

- Use k6 or Artillery against auth, devices, activity, notifications, visitors, wallet, and AI endpoints.
- Add websocket stress scenarios for concurrent device events and notification bursts.

## Stability checks

- Watch memory during prolonged device control, AI use, and navigation across tabs.
- Confirm no duplicate listeners or repeated fetch loops appear after background resume.
