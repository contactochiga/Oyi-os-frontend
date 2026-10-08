# Shared header identity refinement — 2026-10-08

## Exact candidates

- Consumer branch: `codex/oyi-consumer-reference-slice3`; starting HEAD
  `50f2735b674d60f182f9cfc7994533718d5314ae`, clean before editing.
- Shared branch: `codex/oyi-composer-refinement`; starting HEAD
  `54d50158320159904453151edc4b448637e6f597`, v0.4.0, clean before editing.
- New shared version: **0.5.0**, exact pin/commit
  `5b09ec3ee7f0c7574490f6cfcda8afaa3f4b95af`.
- Final Consumer candidate is the commit containing this report.

## Implementation

`<OyiOrb size="identity" state="idle" />` extends the existing shared Orb rather
than adding a logo renderer. It retains the same circular dark body, illuminated
gradient, core and halo layers. Identity-only CSS sets a 44px circle, compact 12px
glow, and optically sized 13px internal lettering. Passive accessible name is
`Oyi`; its state label is preserved as an accessible description. Existing motion,
reduced-motion and page-visibility behavior is reused.

Consumer's runtime diff is exactly two identity JSX replacements: top rail and
sidebar heading. Both lose the external wordmark. No local logo CSS was added.
Central Orb sizes/styling, composer, voice behavior, suggestions, navigation,
history and other runtime logic are unchanged. Backend, Intelligence Quality,
Facility, Office and original Consumer/Twin worktrees were not accessed/modified.

## Visual evidence and tests

[Four-width gallery](../artifacts/oyi-header-identity/index.html): 390, 768, 1024,
1440px screenshots from the built Consumer app. These are clearly labelled local
presentation fixtures, not authenticated production acceptance. HTTP/WebSocket
traffic was intercepted and speech events synthetic; no external execution.

- Shared `npm run check`: PASS, 61 tests, typecheck/build, dist parity,
  publication/realtime firewall and existing compact-host compatibility guards.
- 92 server-render comparisons against v0.4.0: PASS across all existing Orb
  states, old sizes, passive/interactive semantics and compact composer modes.
  This verifies the unchanged shared contract used by Facility; a Facility app
  migration/build was not performed or claimed.
- Consumer `npx tsc --noEmit`: PASS.
- Consumer `npm run build`: PASS; `/ai` unchanged at 25.2 kB / 171 kB first load.
- Consumer `npm run lint`: PASS command, 41 inherited warnings / 0 errors.
- Voice adapter suite: 17 PASS, unchanged behavior.
- Selected Consumer smoke families: 14 PASS / 1 unchanged historical FAIL.
- Browser: 54 PASS / 0 FAIL. Added checks cover 44px circular bounds, centered
  internal lettering, no outside wordmark, exact accessible name, control alignment,
  matching hero/body/core gradient and text color, unchanged central size, reduced
  motion and no overflow at all four widths. Existing voice, history, action-truth,
  confirmation, offline and layout checks still pass.

The old P2 foundation assertion requiring `size="icon"` was updated to the
explicitly approved `size="identity"` contract; navigation assertions remain.
Browser geometry tolerates <0.1px rounding (Chromium reported 44.00015px for a
44px CSS circle). The unrelated contextual-intelligence smoke still expects
previously removed Ask Oyi pills and remains FAIL, not hidden.

Screenshots were visually reviewed: the top-rail logo aligns with adjacent
controls; internal text is legible, centered and contained. The smaller glow and
shared inner gradient preserve the central Orb's visual identity. No tagline,
trademark or standalone wordmark remains in either identity slot.

## Composer ownership audit — no change

The page imports and mounts **shared `OyiComposer`** from `oyi-interaction`.
There is no local duplicate composer renderer. Shared controls, timer/meter
presentation, accessibility and normal/voice layout stay in the package.

Surface-specific responsibilities remain in Consumer:

- `consumerVoiceAdapter.ts`: browser SpeechRecognition implementation of the
  shared voice interface, error/deadline/session lifecycle.
- `/ai/page.tsx`: typed-draft preservation, finish-intent latch, capture timer,
  measured audio acquisition/cleanup, offline guards and canonical `handleSend`
  integration; disabled attachment slot reflects the missing upload contract.

If later extracted, the page-level voice/draft lifecycle belongs in a Consumer
adapter hook implementing the shared callbacks, not in a shared Backend-aware
composer. No extraction or behavior change was made in this identity slice.

## Reproduction / boundaries

Run shared `npm run check`. In Consumer run `npx tsc --noEmit`, `npm run lint`,
`npm run build`, `npm run smoke:oyi-composer-voice`, and:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:oyi-reference-browser
git diff --check
```

The existing 15 smoke names/results are recorded in `smoke-results.jsonl`.
GitHub DNS initially failed; local npm validation used the exact local Git commit,
then manifest/lock references were normalized to GitHub. Installed `dist` matches
the reviewed shared `dist` byte-for-byte. No local dependency URL is committed.
Shared push subsequently succeeded and its remote SHA was verified.

No merge or manual deployment. Authenticated Backend/native acceptance remains
outside this presentation-only change. React review retained existing rendering
and accessible behavior, without introducing new effects or context.

**OYI SHARED HEADER IDENTITY READY FOR APPROVAL.**
