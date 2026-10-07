# Oyi Consumer composer refinement — 2026-10-08

Ready for visual approval; not authenticated-production or native acceptance.
No merge, production rollout, Backend edit, Facility edit, Intelligence Quality
access, or original Consumer/Twin worktree change.

## Candidates and scope

- Consumer branch: `codex/oyi-consumer-reference-slice3`.
- Consumer starting HEAD: `b2b7cb29811d85dc562021e2809ca734739d15a6`.
- Shared starting HEAD: `feff2ed401edd904183e309d5b92c2c64d0fcdc3`.
- Shared v0.3.0 branch: `codex/oyi-composer-refinement`.
- Exact shared commit/pin: `c44fa387550874fdae677c41cb6b54e6ff143812`.
- The Consumer commit containing this document is the final Consumer candidate.

Only the composer, browser voice host adapter, tests, package pin and evidence
changed. Orb, suggestions, navigation, sidebar and conversation feed were not
redesigned. Shared expanded controls are opt-in; default compact hosts retain
their existing behavior. No shared networking or Facility realtime ownership.

## Behavior

Normal: disabled attachment Plus, editable text, Mic, upward Send. Both Mic and
Send remain visible. Send requires non-whitespace text and is disabled while a
turn is pending, offline, or thread restoration prevents submission. Enter uses
the same guarded submission path. Confirmation remains a separate control.

Recording: Cancel, actual recording status/timer (measured level when available),
Stop. Permission waiting is labelled honestly, not counted as recording. Stop
waits for real final SpeechRecognition results/end and never submits. The final
transcript is appended to the draft captured before recording and remains editable.
Cancel invalidates the recognition session and discards transcripts without
clearing pre-existing typed text. Errors also preserve typed text. Late events
after cancellation, failure or completion cannot restore a discarded transcript.
Start has a 10-second deadline; finalization has a 5-second deadline. Interim-only
results are never silently treated as final. Meter resources stop on completion,
cancel, error and unmount, including a late media permission result.

The host implements the existing shared `OyiVoiceAdapter` and translates snapshots
through `voiceSnapshotEvents`. It uses browser SpeechRecognition, not a new native
implementation. Unsupported browsers and native Capacitor hosts report that voice
is unavailable. Meter denial does not fabricate a waveform; the timer remains.

## Attachment compatibility: unsupported

Inspected Consumer `src/services/oyiService.ts` conversation request/transport and
read-only interaction Backend `/oyi/runtime/conversation` route and request mapper.
The established conversation contract is JSON message/context/workflow data; no
supported attachment upload, attachment reference association, or accepted MIME
list was found. Separate `/messages/media/upload`, `/community/media/upload` and
profile uploads do not establish an Oyi conversation attachment contract.

Therefore Plus is disabled with accessible explanatory text/title. No file picker,
upload endpoint, local path transmission, attachment delivery claim or fake removal
UI was added. Picker/image selection/removal acceptance is UNSUPPORTED, not PASS.
Enabling it requires an approved canonical upload/reference/type/size contract.

## Visual and browser evidence

Open [the fixture gallery](../artifacts/oyi-composer-refinement/index.html).
It contains 32 selected screenshots at 390/768/1024/1440 from 66 actual captures
of the built Consumer application. Machine results accompany the gallery.

All API and WebSocket traffic was intercepted, other origins denied, speech and
canonical responses synthetic. No customer identity, real device action or live
Backend was used. The same existing browser harness was extended, not replaced.

42 checks PASS / 0 FAIL. Covered empty/typing controls, upward Send, disabled
attachments, real request-in-flight representation, duplicate submission prevention,
recording timer, Stop/finalization, editable transcript, Cancel preservation,
permission rejection, history/action restoration, confirmation, unobservable result,
unsaved response, offline behavior, short viewport, reduced motion, focus return,
long/table replies and horizontal bounds. No console/hydration errors, unexpected
requests or external access occurred in the intercepted run.

The design remains dark navy and minimal, with unchanged canvas geometry. Desktop
and mobile keep the composer within their existing dock. Actual native keyboard,
safe-area insets and real microphone/provider transcription require physical-device
acceptance; short viewport/fixture tests are not substitutes. No approved Consumer
identity/isolated Backend was available from the prior acceptance checkpoint;
authenticated real conversation acceptance remains BLOCKED, not claimed here.

## Regression results

| Check | Result |
| --- | --- |
| Shared `npm run check` | PASS: typecheck, build, publication/firewall guard, dist parity, 59 tests |
| Consumer `npx tsc --noEmit` | PASS (repository has no `typecheck` npm script) |
| Consumer `npm run lint` | PASS command; 41 warnings, 0 errors |
| Consumer `npm run build` | PASS, static export |
| `npm run smoke:oyi-composer-voice` | PASS: 11 tests including timeout and late callback discard |
| Existing 15 selected Consumer smoke families | 14 PASS / 1 unchanged FAIL |
| Browser fixture suite | 42 PASS / 0 FAIL at all four widths |
| Attachment picking/removal | UNSUPPORTED: missing conversation attachment contract |
| Real microphone/native/authenticated Backend acceptance | NOT RUN / BLOCKED as above |

The unchanged failing `contextual-intelligence-smoke` expects old page-level
`ContextualOyiButton`/Ask Oyi pills removed in ancestral commit `334214f`. Its
expectations were not weakened. Existing dependency/security debt recorded in
`OYI_CONSUMER_SLICE3_FINAL_ACCEPTANCE.md` was not remediated or recertified here.
Lint decreased from 42 to 41 by removing an unused browser-harness catch binding;
no application warning cleanup was included.

Tests intentionally changed old voice auto-send assertions to editable-transcript
handoff, and pin/version assertions to the reviewed shared commit. Action-truth,
authority, history and confirmation expectations remain intact. Shared compact
rendering/firewall tests pass; Facility itself was not changed or revalidated in
its worktree in this slice.

`/ai` build estimate: 24.9 kB route / 171 kB first load, versus prior 23.5 / 170 kB
(approximately +1 kB first load). No WebGL, model, upload or native dependency was
added. This is bundle reporting, not a real-device latency measurement.

## Reproduction and review

```sh
npx tsc --noEmit
npm run lint
npm run build
npm run smoke:oyi-composer-voice
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:oyi-reference-browser
git diff --check
```

The 15 existing smoke command names/results are in `smoke-results.jsonl` and the
prior Slice 3 report. Browser and voice results are committed alongside captures.
Playwright remains external local test tooling, not an application dependency.

GitHub dependency installation initially hit DNS failure. npm was then pointed,
through per-command Git URL rewrites only, to the local shared repository at the
same already-pushed commit. Manifest/lock remain exact GitHub references; no local
path or global Git configuration was committed. Only the shared package entry
changed in the lockfile. No other dependency upgrade was attempted.

Visual approval and genuine browser microphone testing are the next acceptance
steps. Attachment support and native voice remain explicit separate limitations.

**OYI COMPOSER REFINEMENT READY FOR VISUAL APPROVAL.**
