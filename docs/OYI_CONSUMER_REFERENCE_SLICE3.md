# Oyi Consumer reference — Slice 3

Date: 2026-10-07. Implementation and isolated presentation validation complete;
authenticated acceptance remains BLOCKED. No merge, deployment, Backend runtime
change, Facility UI change, or Intelligence Quality change was made.

## Provenance and release

- Consumer branch: `codex/oyi-consumer-reference-slice3`.
- Consumer starting commit: `47d783c3f0d9092a40e176a3c977de72f57d68e6`.
- This document's containing Consumer implementation commit is the reviewed result.
- Shared release branch: `codex/oyi-reference-v0.2.0` (main unchanged).
- Shared version/tag: **0.2.0 / v0.2.0**.
- Shared commit and exact Consumer manifest/lock pin:
  `feff2ed401edd904183e309d5b92c2c64d0fcdc3`.
- Shared release branch and annotated tag pushed. Source and regenerated dist
  passed parity; React remains the only peer, plain CSS, no transport dependency.

The preserved shared draft was reviewed, not replaced blindly. KEEP: icon-size
Orb, caption expansion, notices, additive exports. REFINE: responsive shell and
focus/inert handling, composer mic/send state, native context select, measured
voice levels, redacted publication diagnostics. REJECT: progress inferred from
later action states. INCOMPLETE draft tests were completed. The full review is
`RELEASE_0.2.0.md` in the shared release. Progress now represents only the current
observable state and is deliberately not mounted in Consumer.

## Reference implementation

| Area | Implementation |
| --- | --- |
| Mobile/tablet rail | Hamburger, small shared Orb + Oyi, history, new conversation. No marketing subtitle or dead notification button. |
| Navigation | Existing `consumerSurfaceAdapter.navigation()` and permission-aware `CONSUMER_MODULES`; no duplicate permission registry. |
| Desktop | Sidebar open by default at 1024px; collapsible. Modules, new conversation, shared searchable history, real profile destination when signed in. |
| Canvas | Shared `OyiShell`; calm near-black/navy/blue presentation. No old 108px gutter or bottom navigation on `/ai`. |
| Orb | Shared CSS Orb, hero on `/ai`, small non-interactive identity. No duplicate Orb microphone. No WebGL. |
| Caption | Shared selectable `OyiCaption`, actual response, expand long text; idle has no permanent runtime label. Earlier messages remain expandable. |
| Suggestions | Shared lightweight left-aligned suggestions beside the composer; existing context/static seeds, no awareness-ranking work. |
| Composer | Shared `OyiComposer`, “Write a message”; mic when empty, send when typing; pending duplicate send blocked. IME handling retained. |
| History | Shared `OyiHistory`; existing `/oyi/threads` and messages transport, route/thread restoration, search, new conversation and cached fallback retained. Loading/error/unsaved are explicit. |
| Confirmation | Shared `OyiConfirmation`; separate Confirm/Cancel, original workflow IDs and authority contract; historical controls not reactivated. |
| Action truth | Shared `OyiActionResult`; approved/provider-accepted never promoted to verified. Unobservable remains explicit, including restored threads. |
| Degraded/offline | Shared connectivity + `OyiNotice`; unsaved answer remains visible, offline send disabled. |
| Scope | Existing Consumer surface/home/unit/operational-object adapter unchanged. No invented context options or authority. |
| Home | Visual Orb only replaced with shared CSS Orb; original navigation into `/ai` and dashboard untouched. |
| Voice | Existing Web Speech transport; shared state/callbacks. One mic, stop/cancel, measured levels only. Late microphone acquisition is stopped after cancellation. Native voice deferred. |
| Accessibility | Real buttons, labels, live caption/status, focus-visible, drawer Escape/focus trap/return, inert background, selectable text, reduced-motion static Orb. |
| Responsive | 390/768 drawers, 1024/1440 desktop canvas/sidebar; visual viewport sizing and safe-area CSS. Tables scroll within their own boundary. |

React best-practices review checked event lifecycle and effect dependencies;
the microphone-meter epoch prevents late async acquisition after cancellation.
No streaming or invented thinking/searching/permission stages were introduced.

## Validation

| Check | Result / evidence |
| --- | --- |
| Shared `npm run check` | PASS: typecheck, build, source guard, dist parity, 58 tests including truth, render/accessibility, reduced motion, publication and firewall. |
| Shared dependency audit | PASS: zero reported vulnerabilities. |
| Consumer `npx tsc --noEmit -p tsconfig.next.json` | PASS. |
| Consumer `npm run lint` | PASS exit code; 0 errors, 42 existing warnings. |
| Consumer `npm run build` | PASS static production build. |
| Consumer 15 selected smoke families | 14 PASS; contextual-intelligence FAIL pre-existing (unchanged ConsumerShell lacks expected ContextualOyiButton). Reproduced at starting commit using an isolated archive. |
| Isolated browser presentation | 34 PASS, 0 FAIL at 390/768/1024/1440. Machine results in `artifacts/oyi-consumer-reference-slice3-browser.json`. |
| Authenticated Backend/browser acceptance | BLOCKED: no approved test identity/configuration available. No token fabricated and no credentials requested in chat. |
| Real speech capture / native keyboard / physical execution | NOT VALIDATED; browser fixtures and shortened visual viewport are not those integrations. |
| Facility compatibility | PASS in isolated archive with new exact package pin: 22 contract cases, 18 truth/surface checks, static/runtime realtime firewall, typecheck and build. Original Facility unchanged. |
| Consumer dependency audit | FAIL pre-existing: 9 moderate, 20 high, 5 critical. Exact vulnerability set matched starting lockfile audit; no new vulnerability introduced by package pin. |
| Changed diff/secret checks | PASS: whitespace checks and credential-pattern scan; not a comprehensive security audit. |

Browser checks cover idle, suggestions, empty/typing composer, listening/interim
transcript/cancel, actual intercepted request-in-flight, duplicate send, long
response, table boundary, history restoration, navigation focus, confirmation,
unobservable result, not-saved response, offline and short viewport. There were
no console/hydration errors, failed requests or unexpected external requests.
All HTTP and WebSocket access was isolated/intercepted. No real user, device,
provider or production service was contacted by this browser suite. Signed-in
module visibility is covered by adapter guards, not authenticated browser proof.

Consumer regression command families (all `node scripts/<name>.mjs`):

- `oyi-reference-surface-smoke`, `oyi-interaction-contract-smoke`, `oyi-action-truth-surface-smoke`
- `conversation-final-correction-ui-smoke`, `conversation-thread-foundation-ui-smoke`
- `intelligence-authority-ui-smoke`, `intelligence-turn-context-smoke`
- `device-visible-state-context-smoke`, `command-truth-ui-smoke`
- `context-isolation-smoke`, `context-membership-source-of-truth-smoke`
- `consumer-p2-experience-foundation-smoke`, `resident-language-ui-smoke`, `scene-runtime-v2-ui-smoke`
- `contextual-intelligence-smoke` (known starting-commit failure)

Run the browser suite after building with:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:oyi-reference-browser
```

Playwright is external test tooling, not an added application dependency.

## Bundle impact

Same local Next production-build reporting, starting commit versus candidate:

| Route | Starting route / first load | Slice 3 route / first load |
| --- | --- | --- |
| `/ai` | 25.7 kB / 167 kB | 23.5 kB / 170 kB |
| `/home` | 15.8 kB / 225 kB | 15.7 kB / 230 kB |

`/ai` first-load increase is approximately 3 kB (1.8%); Home approximately 5 kB
for shared visual identity. No three.js, React Three Fiber or WebGL added.
These are build estimates, not real-device interaction latency measurements.

## Files and test changes

Consumer: `package.json`, `package-lock.json`, `src/app/ai/page.tsx`,
`src/app/ai/oyi-reference.css`, `src/app/home/page.tsx`.

Tests: new `scripts/oyi-reference-surface-smoke.mjs` and
`scripts/oyi-reference-browser.mjs`; adapted layout assertions in
`consumer-p2-experience-foundation-smoke.mjs` and
`conversation-final-correction-ui-smoke.mjs`; local fallback assertion in
`oyi-action-truth-surface-smoke.mjs`. Obsolete fixed-composer/108px-rail/bubble
assertions were replaced by shared-shell assertions plus actual browser bounds.
Action, workflow, authority and thread contract expectations were not weakened.

Evidence: this document and the browser JSON. Shared release files are recorded
by `git show --stat feff2ed401edd904183e309d5b92c2c64d0fcdc3` in its repository.

## Remaining acceptance and debt

1. Approved authenticated local/test Backend acceptance must validate actual
   user module permissions, history listing/restoration, home scope and real
   conversation/confirmation contracts. Existing UI fixtures do not replace it.
2. Real mobile keyboard/safe-area and browser microphone/device validation.
3. Existing contextual-entry smoke and inherited dependency vulnerabilities.
4. Native voice, WebGL Orb, awareness-ranked starters and Facility full-page
   adoption remain deferred and require their own approval; not implemented here.

Facility package compatibility is proven without forcing migration. Facility
adoption can be planned after reference acceptance; it was not started. WebGL
should wait for authenticated reference/visual acceptance and explicit approval.
Protected Intelligence Quality and original Consumer dirty worktrees were not
touched. Backend and Facility production pins remain unchanged.

**OYI CONSUMER REFERENCE IMPLEMENTATION NOT YET CERTIFIED**
