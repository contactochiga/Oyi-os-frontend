# Oyi Facility OS - Consumer Handoff Audit

Audit date: May 31, 2026

## 1. Scope And Repository

Facility OS is the estate and facility operations control plane. It is not the resident lifestyle surface and it should not inherit Consumer's calm-home interaction model literally.

Active audited repository:

```text
/Users/ochigaidoko/Documents/facility-oyi
```

A second copy exists at:

```text
/Users/ochigaidoko/Documents/New project/facility-oyi
```

The active audited repository contains current dependencies, build artifacts, and uncommitted Facility work. No Facility files were modified during this audit.

## 2. Product Purpose

Facility OS coordinates:

- estate health and live infrastructure
- homes, units, rooms, residents, and occupancy
- hardware registry, discovery, assignment, and guarded control
- security, cameras, visitors, gate workflows, incidents, and alerts
- maintenance requests and technician workflows
- resident communications and moderation
- wallet and service-payment operations
- utilities, environmental sensors, water, traffic, and operational intelligence
- staff, account settings, permissions, and guarded super-admin operations

Facility should feel like a precise operational command center: denser than Consumer, calmer than an enterprise monitoring wall, and honest about missing telemetry.

## 3. Technology And Session Model

Stack:

```text
Next.js 15.5.9
React 19
TypeScript
Tailwind CSS
Axios
Zustand
Recharts
TanStack Table
Capacitor iOS foundation
HLS.js camera playback
```

API client:

```text
services/api.ts
```

Facility stores its token under:

```text
oyi_facility_token
```

Authenticated requests add:

```text
Authorization: Bearer <token>
X-Ochiga-Surface: facility
X-Oyi-Contract-Version: ochiga.tier1.2026-05-16
```

## 4. Route Inventory

### Auth

| Route | Purpose |
| --- | --- |
| `/login` | Operator login and backend health check |
| `/signup` | Operator signup and OTP flow |

### Operational modules

| Route | Current role |
| --- | --- |
| `/overview` | Facility home and operational summary |
| `/live-infrastructure` | Infrastructure landing wrapper |
| `/digital-twin` | Estate operational canvas |
| `/estate-structure` | Structure landing wrapper |
| `/homes` | Homes and units registry |
| `/homes/:homeId/rooms` | Room management |
| `/homes/:homeId/users` | Home member management |
| `/occupancy` | Occupancy surface |
| `/hardware-devices` | Hardware landing wrapper |
| `/devices` | Registry, discovery, attachment, control, telemetry, edge, report, and integration surface |
| `/security-access` | Security and access landing wrapper |
| `/security` | Security operational page |
| `/cameras` | Camera discovery, binding, playback, events, and AI profile |
| `/visitors` | Gate visitor operations |
| `/alerts` | Notification and incident review |
| `/utilities` | Utility rollup |
| `/water` | Water-specific surface |
| `/environment` | Environmental sensor surface |
| `/traffic` | Visitor and gate movement analytics |
| `/maintenance` | Maintenance operations |
| `/community` | Announcement and moderation control center |
| `/messages` | Resident direct messages and moderation |
| `/services` | Estate service-payment view |
| `/wallets` | Wallet operations |
| `/facility-intelligence` | Analytics and diagnostics landing wrapper |
| `/facility-administration` | Administration landing wrapper |
| `/account` | Operator account settings |
| `/super-admin` | Guarded cross-estate controls |

## 5. Sidebar Module Registry

Source:

```text
lib/moduleRegistry.ts
components/shell/SidebarContent.tsx
```

Permission-aware modules:

```text
Facility Overview
Live Infrastructure
Estate Structure
Hardware Devices
Security & Access
Utilities
Environment & Sensors
Traffic & Mobility
Maintenance Operations
Community & Communications
Wallet Operations
Facility Intelligence
Facility Administration
```

The registry already distinguishes Facility from Consumer appropriately. The next cleanup should preserve operational language while reducing duplicated wrapper/dashboard presentation.

## 6. Frontend Service Contracts

### Auth

```text
POST /auth/login
POST /auth/signup
POST /auth/otp/send
POST /auth/otp/verify
GET  /health
```

### Facility structure and residents

```text
GET    /facility/overview
GET    /facility/estates
POST   /facility/estates
GET    /facility/estates/:estateId/homes
POST   /facility/homes
PATCH  /facility/homes/:homeId
GET    /facility/homes/:homeId/rooms
POST   /facility/rooms
GET    /facility/estate-users
PATCH  /facility/estate-users/:membershipId
DELETE /facility/estate-users/:membershipId
GET    /facility/homes/:homeId/users
POST   /facility/homes/:homeId/invite
PATCH  /facility/home-users/:membershipId
DELETE /facility/home-users/:membershipId
```

### Devices and edge-adjacent registry

```text
GET   /facility/devices
GET   /facility/devices/discover
POST  /facility/devices/register
PATCH /facility/devices/:deviceId/attach
POST  /facility/devices/:deviceId/command
```

Discovery options include Tuya, SSDP, and ONVIF lanes.

### Visitors and access

```text
GET   /facility/visitors
POST  /facility/visitors/verify
PATCH /facility/visitors/:id
GET   /facility/visitors/:id/timeline
POST  /facility/visitors/actions/lockdown
GET   /facility/visitors/reports/export
```

### Cameras

```text
POST /cameras/scan
GET  /cameras/estate/:estateId
POST /cameras/bind
GET  /cameras/:cameraId/hls-token
GET  /cameras/:cameraId/playback
GET  /cameras/:cameraId/events
POST /cameras/:cameraId/events
GET  /cameras/analytics/capabilities
GET  /cameras/:cameraId/ai/profile
PUT  /cameras/:cameraId/ai/profile
```

### Maintenance and alerts

```text
GET  /facility/maintenance
GET  /notifications?unread=true
POST /notifications/read/:id
```

### Community and communications

```text
GET    /community/posts/estate/:estateId
POST   /community/post
PUT    /community/post/:postId
DELETE /community/post/:postId
POST   /community/media/upload
GET    /community/post/:postId/comments
POST   /community/post/:postId/comment
POST   /community/post/:postId/react
POST   /community/post/:postId/view
GET    /messages/residents
GET    /messages/inbox
POST   /messages/thread/direct
GET    /messages/thread/:threadId/messages
POST   /messages/thread/:threadId/messages
POST   /messages/thread/:threadId/read
GET    /messages/mod/reports
POST   /messages/mod/reports/:reportId/resolve
```

### Wallet, services, and super-admin

```text
GET  /wallets
POST /wallets/debit
POST /wallets/init
GET  /services/estate/payments
GET  /super-admin/overview
GET  /super-admin/estates
GET  /super-admin/homes
GET  /super-admin/devices
GET  /super-admin/transactions
GET  /super-admin/activities
GET  /super-admin/audit-logs
GET  /super-admin/estates/:estateId/summary
POST /super-admin/estates/:estateId/status
POST /super-admin/users/:userId/status
POST /super-admin/devices/:deviceId/disable
POST /super-admin/wallets/:walletId/freeze
```

## 7. What Is Working Or Materially Wired

The following areas have real service calls and operational UI:

- authentication and Facility-specific bearer-token client
- overview and estate lookup
- homes and units registry
- room creation per home
- estate users and home-member invitation/update/removal
- device list, discovery, registration, attachment, and command route
- utility summaries derived from devices, maintenance, notifications, and overview
- visitor list, verification, status update, timeline, lockdown, and export
- camera discovery, binding, playback token, event, and AI-profile paths
- maintenance listing and extended maintenance UI
- community post, comment, reaction, view, upload, and moderation UI
- direct messages and moderation report queue
- wallet funding/debit surfaces
- service-payment listing
- guarded super-admin routes

## 8. Legacy, Dirty, Or Incomplete Areas

### Wrapper-dashboard duplication

These routes currently use `components/modules/ModuleDashboard.tsx` and contain static readiness copy around links to deeper operational pages:

```text
/live-infrastructure
/estate-structure
/hardware-devices
/security-access
/facility-intelligence
/facility-administration
```

They provide navigation, but they can feel repetitive and dashboard-heavy. The first Facility visual pass should convert these wrappers into concise operational landing surfaces with live incident priority.

### Browser prompt and confirm flows

Replace with proper Facility modals:

```text
app/(protected)/messages/page.tsx
  window.prompt moderator note

app/(protected)/homes/[homeId]/users/page.tsx
  confirm remove member
  prompt role
  prompt full name
  prompt username
  prompt email
```

### Device normalization risks

`services/deviceService.ts` currently:

- synthesizes a random UUID when backend identity is absent
- synthesizes `created_at` with the current timestamp when absent
- catches list failures and returns an empty array silently

For an operational registry, missing identity and API failures must remain explicit. Randomized identity can destabilize list rendering and assignment reasoning.

### Digital Twin boundary

`/digital-twin` is a useful operational placeholder but not a true estate model. It derives some zone and floor placement heuristically from homes and list position. Keep it clearly labeled as a foundation until plan, model, render, and telemetry adapters are live.

### Camera fallback boundary

Camera playback has a useful legacy HLS fallback. Camera AI profile UI may save locally when backend profile endpoints return fallback status. This must be labeled clearly and validated against live camera hardware before rollout.

### Utilities boundary

Utilities are currently derived from generic device metadata, maintenance text, unread notifications, and overview counts. Dedicated power, water, network, and sensor APIs remain a backend priority.

### Realtime boundary

Most operational pages refresh by request. Facility needs a single realtime incident and telemetry strategy for alerts, visitors, devices, cameras, utilities, maintenance, and edge heartbeat.

### Permission audit boundary

Menu visibility is permission-aware, but the next audit must confirm every mutation fails closed server-side, especially:

- lockdown
- device commands
- home-member mutation
- camera binding and AI profile updates
- wallet debits and freezes
- super-admin actions

## 9. Existing Local Facility Work

The active Facility worktree already contains uncommitted changes. They were inspected but not modified:

```text
app/(protected)/community/page.tsx
app/(protected)/estate-structure/page.tsx
app/(protected)/facility-administration/page.tsx
app/(protected)/facility-intelligence/page.tsx
app/(protected)/hardware-devices/page.tsx
app/(protected)/live-infrastructure/page.tsx
app/(protected)/security-access/page.tsx
components/modules/ModuleDashboard.tsx
services/communityService.ts
```

Do not overwrite or revert these files during the first Facility cleanup pass without reconciling the existing work.

## 10. Design Direction For Facility Cleanup

Facility OS should use:

- an operational command-center shell
- compact live estate-health hierarchy
- incidents before analytics
- action queues before decorative metrics
- staff workflows and resident requests
- infrastructure registry state
- truthful pending integrations
- dense but calm information surfaces
- modals and sheets instead of browser prompts

Facility OS should not become:

- Consumer lifestyle UI
- a wall of giant cards
- a marketing dashboard
- a generic enterprise admin template
- a fake telemetry simulator

## 11. Cleanup Priority Order

1. Facility shell, overview, and wrapper-dashboard consolidation.
2. Homes, residents, and member-management modal cleanup.
3. Devices and hardware registry identity/error hardening.
4. Visitors, access, security, and camera operational workflow polish.
5. Maintenance assignment, status, SLA, and escalation workflow.
6. Community announcements, messages, and moderation modal cleanup.
7. Utilities, water, environment, and realtime telemetry contracts.
8. Wallet, services, reports, staff, and administration.
9. Digital Twin adapter architecture and edge heartbeat integration.
10. End-to-end permission, realtime, and physical-hardware smoke tests.

## 12. Readiness Assessment

| Area | Readiness |
| --- | --- |
| Facility authenticated shell and overview | `75%` |
| Homes, units, residents, and occupancy | `70%` |
| Hardware registry and guarded commands | `65%` |
| Visitors and access | `72%` |
| Security and cameras | `60%` |
| Maintenance | `68%` |
| Community and messages | `70%` |
| Wallet and services | `58%` |
| Utilities and telemetry | `52%` |
| Digital Twin | `45%` |
| Backend foundation for Facility | `72%` |
| Facility OS overall | `65-70%` |

The primary constraint is not route count. It is converting broad operational foundations into a cohesive live control plane backed by real hardware, dedicated telemetry, realtime events, fail-closed permissions, and finished staff workflows.

## 13. Recommended First Facility Cleanup Prompt

```text
Run Facility OS Phase 1 shell and overview consolidation.

Preserve backend routes and existing local changes.
Do not redesign operational modules from scratch.

Goals:
1. Unify Facility shell, sidebar, topbar, and overview visual hierarchy.
2. Replace dashboard-wrapper repetition with concise operational landing surfaces.
3. Prioritize live incidents, resident requests, infrastructure posture, and staff queues.
4. Remove fake/static readiness activity from visible operator surfaces.
5. Keep honest Pending Integration states where backend telemetry is absent.
6. Preserve Facility permission-aware navigation.
7. Do not touch Consumer OS.
8. Run Facility build and typecheck.

Return:
- files inspected
- files changed
- shell changes
- overview changes
- wrapper consolidation result
- remaining workflow blockers
- build results
```
