# Final voice composer refinement — 2026-10-08

## Candidates

- Consumer: `codex/oyi-consumer-reference-slice3`, starting at
  `9ede3d9aa21abaeb2d3b3dd49a225ced9479e6c2`; candidate is the commit containing
  this report.
- Shared: `codex/oyi-composer-refinement`, starting at
  `c44fa387550874fdae677c41cb6b54e6ff143812`.
- Exact new shared pin: `54d50158320159904453151edc4b448637e6f597`, v0.4.0.

Only the composer primitive/styles, Consumer browser voice adapter/integration,
related tests, dependency pin and acceptance evidence changed. No Orb, sidebar,
navigation, suggestions or feed redesign. No Backend, Facility, Intelligence
Quality or original Consumer/Twin worktree access or changes in this refinement.
No merge or manual deployment.

## Contract and state transitions

The expanded recording row is Cancel → blue indicator → elapsed timer → measured
level bars → Stop → Send. The redundant visible Recording/interim labels are
removed from the row. The recording status remains screen-reader accessible;
actual interim words remain in the existing caption. The indicator blinks only
while recording, becomes static during finalization, and never blinks under
reduced-motion preferences. No simulated amplitude is rendered in production:
the existing meter uses actual input levels, or only the timer if unavailable.

Shared `onSendVoice` is additive and opt-in. Compact hosts preserve their original
controls; the shared package never owns speech capture, network or authority.

| Input | Result |
| --- | --- |
| Start | Preserve typed draft; wait for actual recognition start before recording/timing |
| Stop | Latch review intent, stop capture, wait for final results and end, append complete transcript to editable draft; no submission |
| Send while recording | Latch send intent, stop capture, wait for complete final results and end, append transcript to typed draft, submit once through existing `handleSend`/canonical conversation request |
| Rapid Stop/Send/Send | First action wins synchronously; later actions cannot change intent; both controls disabled during finalization |
| Cancel, including during finalization | Invalidate session and pending send intent; discard recording only; restore typed draft |
| Empty, unfinished tail, error or timeout | Do not auto-submit, even when typed text exists; recover available words as editable draft and show an error |
| Natural recognition end without Send | Editable draft only |
| Unmount | Unsubscribe, invalidate pending send, abort capture and release meter/timer resources |

Final SpeechRecognition results are cumulative; segments are joined in index
order and repeated cumulative events do not duplicate them. A final prefix plus
an unfinished interim tail is an error, not a partial successful message. A
session epoch invalidates captured late handlers after completion/cancel/error.
Construction failure resets previous transcripts before attempting the new API
instance, preventing old words from being recovered into a new recording.

The existing 10-second start and 5-second finalization deadlines remain. No new
provider, native plugin, Backend endpoint or automatic execution authority was
introduced. Voice Send is an ordinary conversation submission, not confirmation.

## Validation and evidence

See [labelled screenshot gallery](../artifacts/oyi-voice-composer-final/index.html)
and its browser, adapter and regression machine-readable results. Actual built
Consumer UI was served locally at 390/768/1024/1440. All API/WebSocket traffic was
intercepted; speech events and amplitude readings were controlled synthetic fixtures.
No real customer data, credentials, provider calls or physical actions were used.

- Shared `npm run check`: PASS, 60 tests; typecheck/build, dist parity,
  publication/firewall, compact compatibility and accessibility/reduced motion.
- Consumer `npx tsc --noEmit`: PASS.
- Consumer `npm run lint`: PASS command, 41 existing warnings / 0 errors.
- Consumer `npm run build`: PASS. `/ai` 25.2 kB route / 171 kB first load, versus
  prior 24.9 / 171 kB. No new runtime dependency beyond the shared package update.
- `npm run smoke:oyi-composer-voice`: PASS, 17 checks covering segments,
  unfinished tail, empty result, errors, cancellation, repeated Stop, deadlines,
  late callbacks, cleanup, unsupported/native hosts and stale construction failure.
- Existing selected Consumer regressions: 14 PASS / 1 unchanged FAIL.
- Browser: 54 PASS / 0 FAIL across all four widths. Includes Send exactly once,
  finalization wait, first-wins Stop/Send race in the same browser evaluation,
  late end callback, Cancel during finalization, recoverable empty/partial/error/
  timeout, existing draft preservation, permission denial, reduced motion,
  blinking enabled when allowed, waveform/timer, normal and recording short
  viewport bounds, history/action truth, offline/unsaved state and keyboard Send.

The initial browser test used an exact text locator unsuitable for the reply's
caption markup. The visible reply and request were present; the locator was
corrected to the assistant message containing the expected response. Runtime and
response expectations were not weakened.

The unchanged `contextual-intelligence-smoke` failure expects old Ask Oyi pills
removed before this work (ancestral `334214f`). It remains recorded as FAIL;
no unrelated UI/test expectation was changed to hide it. Previous dependency
security maintenance debt remains separate; no dependency remediation or security
clearance is claimed.

## Browser/native limitations

An unmodified headless Chromium probe exposed SpeechRecognition and media capture,
with microphone permission `prompt`. No interactive permission/audio was supplied
to that probe: real microphone/provider transcription is NOT RUN, not PASS.
The controlled suite tests browser-event semantics, not speech accuracy or vendor
service availability. A supported interactive browser still requires human
permission and a functioning browser transcription service.

Native iOS/Android WebView speech is not implemented or certified. Unsupported
hosts show the existing honest error. Short viewport tests approximate keyboard
clearance; real native keyboard/safe-area acceptance remains pending. Approved
authenticated test Backend/Consumer identity acceptance remains unavailable, as
recorded in the prior acceptance report. Attachment support remains disabled:
this refinement adds no upload contract.

## Reproduction and dependency provenance

```sh
# Shared repository
npm run check
# Consumer repository
npx tsc --noEmit
npm run lint
npm run build
npm run smoke:oyi-composer-voice
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:oyi-reference-browser
git diff --check
```

The 15 regression family names/results are in `smoke-results.jsonl`. Playwright
remains external local tooling. All captions/screenshots are explicitly fixtures.

GitHub archive DNS failed during npm installation. npm installed the identical
already-pushed shared Git commit from its local repository, then manifest/lock
URLs were normalized to exact GitHub commit references. No local path is shipped;
installed `dist` was compared byte-for-byte with the shared repository's reviewed
generated `dist`. No unrelated lockfile package changed.

The React review focused on committed-handler freshness, synchronous finish-intent
latching, effect cleanup and accessibility. It introduced no new context/runtime.

**OYI VOICE COMPOSER REFINEMENT READY FOR APPROVAL.**
