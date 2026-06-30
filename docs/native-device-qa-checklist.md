# Consumer Native Device QA Checklist

## Auth and session

- Fresh install reaches login correctly.
- Login succeeds with the intended backend environment.
- Logout clears local session and native preference state.
- Relaunch restores session only when expected.

## Navigation and shell

- Bottom navigation remains visible above safe areas.
- AI opens and remains usable with the keyboard visible.
- Notifications and activity lists remain scroll-stable.

## Core flows

- Device state loads and updates after manual refresh and realtime events.
- Visitor flow shows approval, arrival, and timeline details.
- Wallet flow loads balances, obligations, and payment actions safely.
- Activity/runtime feed remains readable on phone-sized devices.

## Native behavior

- Push permission prompt appears once and token registration succeeds where configured.
- Deep links open the expected in-app destination where configured.
- Offline or slow-network messaging is understandable and recoverable.
