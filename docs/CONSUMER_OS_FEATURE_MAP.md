# Consumer OS Feature Map

Last updated: 2026-06-13

## Core Navigation

| Route | Module | RC Status | Backend Dependency |
| --- | --- | --- | --- |
| `/home` | Home dashboard and awareness | RC-ready | context, activity, devices, services, intelligence |
| `/spaces` | Rooms/spaces overview | RC-ready | rooms, devices |
| `/devices` | Device control and live state | RC-ready, provider validation needed | devices, device state, socket, Tuya/provider |
| `/community` | Estate community feed and official notices | RC-ready | community posts/read state |
| `/activity` | Activity and intelligence metrics | RC-ready | activity, notifications, intelligence summaries |
| `/visitors` | Visitor access | RC-ready | visitors/access |
| `/wallet` | Wallet and payments | RC-ready, payment/provider validation needed | wallets, transactions, Paystack/service handlers |
| `/maintenance` | Maintenance requests | RC-ready | maintenance requests and updates |
| `/services` | Facility-driven service registry | RC-ready | `/services/home-registry`, wallets, service configs |
| `/profile` | Profile, home context and account | RC-ready | profile, home, memberships |
| `/ai` | Oyi Intelligence | RC-ready | `/ai/chat`, confirmations, intelligence tools |
| `/watch` | Watch companion status | Beta | watch sync/backend endpoints |
| `/security` | Security surface | Beta | security/camera/notification dependencies |
| `/utilities` | Utilities surface | Beta | utility services |
| `/reports` | Reports | Beta | reporting/intelligence data |
| `/support` | Support | RC-ready | support/maintenance workflows |

## System Bridges

| System | Status | Notes |
| --- | --- | --- |
| Context switching | RC-ready | Scoped fetches depend on active estate/home context. |
| Footer badges | RC-ready | Uses unread/attention state where available. |
| Push registration | RC-ready | Static Capacitor plugin imports are required. |
| Service registry | RC-ready | Consumer Services reads active-home registry as source of truth. |
| Device live state | RC-ready with provider dependency | Live provider/state stream must be validated on real devices. |
| Proximity awareness | Beta | Requires explicit user permission and operational geofence validation. |
| Camera panels | Beta | Playback depends on backend/edge camera runtime. |
| Watch sync | Beta | Companion foundation exists; physical Watch smoke recommended. |

## Intelligence Visibility

Consumer OS exposes Intelligence Core value through:

- Home awareness language
- Activity metrics and summaries
- Maintenance status
- Services awareness and registry state
- Profile/home context
- Full `/ai` conversation screen
- Floating Oyi console

## Data Boundary Rules

- Home/estate-scoped data must use the active context.
- Services must use `/services/home-registry` instead of local inference.
- Device, activity, community, visitor, maintenance and wallet state must not bleed across homes.
- Debug-only data must not be shown to residents.
