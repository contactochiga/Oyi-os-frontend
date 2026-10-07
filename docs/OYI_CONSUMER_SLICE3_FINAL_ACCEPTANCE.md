# Slice 3 final acceptance — 2026-10-07

**OYI CONSUMER REFERENCE ACCEPTANCE BLOCKED**

The local reference presentation passes its available checks and is ready for
human visual approval. Authenticated acceptance remains pending. No runtime,
layout, dependency, production, Backend or Intelligence Quality changes were
made in this acceptance pass. No merge/deployment or credential fabrication.
Only local acceptance documentation, machine evidence and screenshots were added.

## Exact candidates

- Consumer: `55b0d1745cf778f47a5533b1fe0983566002eb4d`.
- Shared: `feff2ed401edd904183e309d5b92c2c64d0fcdc3`, `v0.2.0`.
- Consumer's package pin remains exact; neither candidate SHA changed.
- Facility checkout remains `9a5146a09d6ba30d2d3ca4ae3506f074aeca7850`.

## Visual evidence

Open `../artifacts/oyi-slice3-acceptance/index.html` for **50 full-resolution
screenshots** from a fresh production build served locally. Every screenshot is
labelled in the gallery as a presentation fixture, not authenticated production.
`evidence.json` records all 34 checks, 42 lint findings and 34 audit package entries.

At each width (390, 768, 1024, 1440), captures include idle, history,
restored-unobservable action, listening, typing, request-in-flight, long answer,
table answer, confirmation, unobservable/not-saved, offline and short viewport.
390/768 also include the open navigation drawer; desktop captures already show
the open sidebar. Composer is included throughout. All HTTP/WebSocket traffic
was intercepted locally; speech events and canonical API results were synthetic.
The images contain no production customer data.

| Approved characteristic | Observed result |
| --- | --- |
| Minimal dark navy, Oyi-first | PASS: calm canvas, no marketing subtitle or dashboard card grid. |
| Small identity | PASS: compact Orb/wordmark beside mobile controls. Desktop also has sidebar identity. |
| Central Orb | PASS: visual focus of idle canvas; calm CSS renderer, reduced-motion capture. |
| Lightweight suggestions near composer | PASS: left-aligned rows, no heavy tiles. |
| Desktop sidebar | PASS: docked at 1024/1440, drawer at 390/768. Fixture shows only anonymous-eligible modules; signed-in menu coverage is pending. |
| No phantom gutter | PASS: main column begins directly after actual sidebar; mobile fills viewport. |
| No invented reasoning | PASS: Working only while intercepted HTTP request is pending. No reconstructed internal steps. |
| Single mic | PASS: one composer mic while empty; send replaces it when typing. Orb is non-interactive. |
| Bounds/focus | PASS: no horizontal overflow/clipped composer; long/table responses stay contained; Escape and focus return tested. |

This is an implementation review, not a substitute for the user's visual approval.
Native keyboard/safe-area, real microphone and non-reduced-motion real-device
performance remain unverified.

## Authenticated flow boundary

Story: Consumer `/ai` → existing canonical conversation/thread endpoints →
authorised Backend data → response/history/action-truth presentation.

| Boundary | Result |
| --- | --- |
| Local UI renders | PASS |
| Client request and canonical-shaped response rendering | PASS with intercepted fixtures only |
| Approved identity + isolated Backend | BLOCKED |
| Real Backend/data/identity/permission validation | NOT RUN because prerequisite is absent |

Exact access evidence: Consumer has no `.env*` files; process environment has no
TEST/E2E/PLAYWRIGHT/STAGING or public API test configuration keys. Interaction
Backend has only `.env.example`, no test/staging environment file. Scoped docs
and scripts identify no provisioned Consumer acceptance identity. The localhost
API fallback at port 5000 is a default, not proof of an approved test service.
No arbitrary listener, production cookie/token, customer account, unrelated
worktree fixture or Vercel production environment was used.

Required next operation: provision or identify an approved non-production Backend
and synthetic Consumer identity with known home/role permissions through the
existing secure local configuration mechanism (not credentials in chat).
Then validate authenticated entry, menu permissions, real turn/thread creation,
history load/restore, home/context switching, safe confirmation/action truth and
isolated offline/persistence failures. No physical-device execution is needed.
The existing UI shows actual context from the adapter; it does not fabricate a
context selector. Authenticated selection must use the existing app context flow.

The verification skill's boundary rule kept the live path stopped at missing
approved access. Environment guidance was used only to inspect configuration
presence; no environment was pulled or changed.

## Existing smoke failure: classified, not hidden

`contextual-intelligence-smoke.mjs`: **6 checks PASS / 1 FAIL**. Its failed check
expects page-level `ContextualOyiButton` in ConsumerShell and old Ask Oyi pills
on Devices/Scenes. Commit `334214f11712b478824079cb91516a233e237e75` explicitly
removed those pills; it is an ancestor of Slice 3's starting commit `47d783c`.
The shell/device/scene files have no Slice 3 diff. Current Devices still has its
device-specific prompt; the removed page-level entry is not the same control.

Classification: stale historical presentation expectation following an intentional
earlier design change, not a new `/ai` scope/action regression. The test should
be reconciled with the currently approved contextual-entry specification in a
separate maintenance change. It remains FAIL here; no assertion was weakened.
The source/context/transport checks in that same smoke pass. This does not
prove all authenticated context handoffs work; that remains pending above.

## Lint maintenance ledger

Fresh ESLint JSON: **42 warnings, 0 errors**:

- 15 effect/memo dependency warnings: potential stale context, missed refresh or
  lifecycle issues in existing activity/community/live-session/device/home/profile/
  scenes/security/auth/live-state/signal paths. These can affect runtime; they are
  not all cosmetic and warrant targeted regression-backed review, not automatic fixes.
- 13 unused-variable warnings: 12 application findings plus **one Slice 3 browser
  harness catch binding**. This corrects the earlier blanket “42 existing” wording.
  The harness warning has no shipped runtime effect; it is left recorded, not hidden.
- 9 raw-image warnings: performance/loading/layout debt across existing modules,
  not demonstrated authority or security defects.
- 5 unused eslint-disable warnings: maintenance-only.

Exact file/line/rule/message for every warning is in `evidence.json`. `/ai` itself
has no ESLint warning. No unrelated warning cleanup was attempted.

## Dependency/security triage

Fresh audit: **34 affected package entries: 5 critical / 20 high / 9 moderate**.
The vulnerability object matches the starting-lockfile audit exactly. These are
not 34 independently proven exploitable application paths. Equally, inherited
does not mean harmless. No automatic audit fix/downgrade was applied.

| Family | Exposure assessment and next action |
| --- | --- |
| Capacitor Android/iOS 6.2.1 (critical) | Native production-relevant. Podfile.lock also records 6.2.1. They are packaged native runtime despite npm dev flags. Prioritise a separate patched native dependency/rebuild acceptance before native release; no exploit was attempted. |
| Axios 1.18.1 (high) | Imported by actual API transport. Some findings concern Node HTTP/HTTP2; others are conditional prototype-pollution gadgets. Browser usage is not blanket exemption. Triage exact adapter/reachability and patch separately; no demonstrated exploit here. |
| Next 15.5.20 (critical), sharp, PostCSS/source-map, nanoid | Repository builds `output: export`, images unoptimized, Capacitor webDir out. Reported server/Server Action/image-optimizer routes are not executed by this tested static artifact. Build-tool risk and any alternative server deployment require separate assessment; no production hosting audit or universal safety claim. |
| next-auth (critical), Firebase family/grpc/undici, uuid | Installed, but source import search found no active app imports for next-auth/Firebase/uuid. Treat as dependency/conditional-use debt, not proof of active `/ai` exposure; confirm transitive/bundle/native use before removal. |
| tar/Capacitor CLI (critical/high), xmldom | Native build/toolchain supply-chain/input risk, not browser conversation execution. Still protect CI/developer environments and patch separately. |
| ESLint/Next ESLint/fast-glob/micromatch/braces/brace-expansion/humanfs/browserslist/baseline-browser-mapping/js-yaml | Primarily build/lint tooling and dependency chains. Untrusted files/config can matter; not evidence of a new runtime UI vulnerability. |

The native Capacitor advisory states that crafted in-app links can load remote
content with app-origin privileges, including plugin access; disabling the HTTP
plugin alone is insufficient. The maintained 6.x fix is 6.2.2, followed by rebuild
and redistribution. Source: [Capacitor maintainer advisory](https://github.com/ionic-team/capacitor/security/advisories/GHSA-rvm3-566m-v7fv).
This acceptance pass did not inspect deployed app binaries and does not claim
they are running this exact native version.

Release risk conclusion: visual acceptance can proceed independently, but this
is **not security clearance for production/native rollout**. Native dependency
remediation and authenticated acceptance are separate outstanding gates.

## Fresh regression results

- Consumer production build: PASS; typecheck: PASS.
- Consumer lint: PASS command exit, 42 warnings / 0 errors (above).
- Consumer selected smoke families: 14 PASS / 1 FAIL (historical assertion above).
- Browser: 34 PASS / 0 FAIL; 50 captures; all four widths; no console/hydration
  errors, failed requests or unexpected external access under fixture execution.
- Shared `npm run check`: PASS, 58 tests, typecheck/build/guard/dist parity,
  reduced-motion/accessibility/truth/publication/firewall.
- Facility in existing isolated compatibility copy: contract and action-truth
  suites PASS, including static/runtime realtime firewall. Original Facility
  checkout unchanged. Prior Slice 3 typecheck/build passed; not re-run this pass
  because neither source nor dependency changed.
- Consumer fresh `npm audit --json`: findings above; no new dependency change.
- Whitespace/diff checks: PASS. No new executable source/secret changes.

Consumer smoke families and reproducible browser commands remain listed in
`OYI_CONSUMER_REFERENCE_SLICE3.md`. Fresh command logs are local `/tmp/oyi-final-*`;
durable selected outputs and screenshots are in the acceptance artifact directory.

## Final decision / next slices

Consumer is visually ready for approval, **not yet fully certifiable** without
approved authenticated testing. Facility compatibility remains proven, but its
adoption should await reference acceptance and explicit next-slice approval.
WebGL likewise remains deferred: do not compound unaccepted interaction changes.
No layout correction was required; the only correction is the lint provenance
statement in this report. All candidate source/package SHAs remain unchanged.

**OYI CONSUMER REFERENCE ACCEPTANCE BLOCKED**
