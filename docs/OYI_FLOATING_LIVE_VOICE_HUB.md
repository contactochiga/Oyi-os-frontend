# Floating Live Voice Hub — visual approval candidate

Date: 2026-10-08. No merge or deployment performed. No Intelligence Quality,
Backend, Facility, Office or original Consumer/Twin worktree accessed or modified.

## Revisions

- Consumer starting HEAD: `50c5f1b009d618a82e1d3a4e9539e49e7f31035a`.
- Consumer branch: `codex/oyi-consumer-reference-slice3` (the commit containing
  this document records the final implementation).
- Shared starting HEAD: `5b09ec3ee7f0c7574490f6cfcda8afaa3f4b95af`, v0.5.0.
- Shared final pin: `2326e20011420c3194c2e8c1eeff5186b88828dd`, v0.6.0,
  `codex/oyi-composer-refinement`.
- Shared commits: `4059291` (hub/session), `a4957c6` (late start rejection),
  `256caab` (actual activity labels/Escape), `2326e20` (late callback regressions).

Both starting worktrees were clean. Shared source/dist parity passed; all 61
installed dist files byte-match the reviewed shared build. The final package
was installed from the local committed Git object while system GitHub DNS was
intermittent; manifest and lockfile retain the exact remote HTTPS commit pin,
not a local path. No dependency other than the shared pin changed.

## Implementation

Reused `OyiOrb`, `OyiComposer`, `OyiShell`, `OyiVoiceLevel`, existing caption,
history, confirmation, action truth, Consumer speech adapter and canonical
`aiService.chat` request. There is no second conversation or history path.

New shared contracts/components:

- `OyiLiveVoiceHub`: compact, non-modal dock panel above the composer; one End
  button, mute/resume, actual Listening/Speaking labels, selectable caption,
  existing 56px CSS Orb, measured-only waveform.
- Additive `OyiShell.voiceHub` slot and opt-in empty-draft Live Voice button.
  Old hosts retain their original composer/shell rendering.
- `createOyiLiveVoiceSession`, `OyiLiveVoiceSnapshot`, `OyiSpeechOutput`:
  callback-only half-duplex lifecycle; no network or authority ownership.
- Consumer `createConsumerSpeechOutput`: browser playback implementation.
  Existing recognition adapter gains opt-in single-utterance capture.

Empty chat shows the central Orb; active chat does not. Header identity is
unchanged. Opening voice temporarily replaces the empty-chat hero with the
compact hub. The message composer remains mounted with identical styling and
geometry; its one-shot microphone is disabled while live capture owns audio.
Typed text remains editable and is preserved across live turns. Typed Send
mutes live input and uses the existing request path.

## Transport audit and implemented behavior

This is **browser Web Speech**, not a native or server-side voice transport.
Recognition uses `SpeechRecognition`/`webkitSpeechRecognition`, in single-
utterance mode only for live sessions. Output uses `speechSynthesis` and
`SpeechSynthesisUtterance`. Browser/vendor recognition may itself depend on a
network service. Feature presence does not guarantee service availability.

Permission/onstart → actual listening → finalized segments/onend → one
canonical request → actual response → queued output → actual output onstart
→ actual output onend → listen for the next utterance. There is no full-duplex
barge-in and no automatic retry/resend after failure. A missing or unfinished
transcript is never submitted. Queuing output is not labeled Speaking.

Mute/End invalidate pending capture and playback callbacks. End does **not**
undo a request already submitted to Core: its reply still appears in chat,
but does not restart playback/capture. Hidden page/offline pauses voice until
explicit resume. Scope, actor, thread restoration and New conversation end the
session. Unmount cancels speech, capture, metering and listeners. One-shot
Stop/review, Send/finalize and Cancel/draft restoration remain unchanged.

Recognition start is bounded at 10s; finalization at 5s. Playback start is
bounded at 10s and playback at 120s. Timeout/error does not invent success.
Canonical workflow/confirmation IDs and action truth remain Backend-owned;
neither speech completion nor provider acceptance implies physical verification.

## Visual evidence — synthetic fixtures, not authenticated production

The built Consumer `/ai` application was rendered at all four widths, using
intercepted canonical HTTP responses and controlled speech/media events.
No credentials, customer data or physical-device actions were used.
All non-local origins were refused by the test harness.

| Width | Empty canvas | Listening | Speaking | Confirmation | Short viewport / muted |
|---|---|---|---|---|---|
| 390 | [image](../artifacts/oyi-live-voice/390-idle-fixture.png) | [image](../artifacts/oyi-live-voice/390-live-listening-fixture.png) | [image](../artifacts/oyi-live-voice/390-live-speaking-fixture.png) | [image](../artifacts/oyi-live-voice/390-live-confirmation-fixture.png) | [image](../artifacts/oyi-live-voice/390-live-keyboard-muted-fixture.png) |
| 768 | [image](../artifacts/oyi-live-voice/768-idle-fixture.png) | [image](../artifacts/oyi-live-voice/768-live-listening-fixture.png) | [image](../artifacts/oyi-live-voice/768-live-speaking-fixture.png) | [image](../artifacts/oyi-live-voice/768-live-confirmation-fixture.png) | [image](../artifacts/oyi-live-voice/768-live-keyboard-muted-fixture.png) |
| 1024 | [image](../artifacts/oyi-live-voice/1024-idle-fixture.png) | [image](../artifacts/oyi-live-voice/1024-live-listening-fixture.png) | [image](../artifacts/oyi-live-voice/1024-live-speaking-fixture.png) | [image](../artifacts/oyi-live-voice/1024-live-confirmation-fixture.png) | [image](../artifacts/oyi-live-voice/1024-live-keyboard-muted-fixture.png) |
| 1440 | [image](../artifacts/oyi-live-voice/1440-idle-fixture.png) | [image](../artifacts/oyi-live-voice/1440-live-listening-fixture.png) | [image](../artifacts/oyi-live-voice/1440-live-speaking-fixture.png) | [image](../artifacts/oyi-live-voice/1440-live-confirmation-fixture.png) | [image](../artifacts/oyi-live-voice/1440-live-keyboard-muted-fixture.png) |

The hub is at most 420px wide and under 220px tall in tested normal layouts;
it has a 12px gap above the composer. The scrolling conversation remains above.
At a 450px visual viewport, decorative Orb content collapses, leaving voice
controls and input visible. This validates viewport geometry, not a physical
iOS/Android keyboard. Composer geometry before/after hub opening matches.
Reduced motion is respected. No horizontal overflow, console/hydration errors
or unexpected requests were observed in the controlled run.

## Validation

| Check | Result |
|---|---|
| Shared `npm run check` | PASS: typecheck/build/guards/dist/expectations; 71 tests |
| Shared prior-host SSR comparison | PASS: 62 Orb/composer/shell comparisons against v0.5.0 |
| Shared Facility realtime firewall | PASS: no sockets, EventSource, network or Facility lifecycle ownership |
| Consumer `npx tsc --noEmit` | PASS |
| Consumer `npm run build` | PASS |
| Consumer `npm run lint` | PASS with 41 existing warnings; zero errors |
| `node scripts/oyi-live-voice-smoke.mjs` | PASS: 6 browser output/live input contract tests |
| `npm run smoke:oyi-composer-voice` | PASS: 17 existing one-shot voice contracts |
| `PLAYWRIGHT_MODULE=/tmp/oyi-browser-tools.f6p0jz/node_modules/playwright/index.mjs node scripts/oyi-reference-browser.mjs` | PASS: 62 checks across 390/768/1024/1440 |
| Relevant Consumer smoke families | 14 PASS; 1 known pre-existing FAIL |
| Diff whitespace / changed-file secret review | PASS before commit |
| Real microphone and browser speech-service integration | NOT RUN: no interactive microphone approval/real audio; feature probe only |
| Authenticated test Backend and durable persistence | NOT RUN: fixture contracts only; not claimed as live acceptance |
| Facility application build | NOT RUN: protected worktree untouched; shared backward compatibility checked instead |

Passing smoke families: reference surface, shared interaction contract, action
truth surface, final-correction UI, thread foundation, intelligence authority,
turn context, device visible state, command truth, context isolation,
membership source-of-truth, Consumer P2 foundation, resident language and
scene runtime v2. The existing `contextual-intelligence-smoke.mjs` still expects
the removed `ContextualOyiButton` in ConsumerShell; it predates this change and
is not a Live Voice regression. Its expectation was not weakened.

Browser tests prove canonical request once-only submission, actual reply
playback sequencing, thread reuse, retained typed draft, confirmation not
auto-approved, history restoration/action-unobservable truth, not-saved notice,
mute/end, late callbacks, permission error/retry, page-hidden pause, offline
pause, one-shot finalization, reduced motion and safe viewport layout.

## Performance and remaining acceptance

`/ai` route: **25.2 → 27.7 kB**; reported first-load JS: **171 → 174 kB**.
No new runtime dependency, WebGL or additional Backend request per spoken
turn. Meter updates are bounded to one sample per 80ms, at most 12.5Hz, only
while actually listening; all unnecessary capture/rendering pauses when hidden.
This is bundle/fixture evidence, not real-device battery or speech latency data.
The React review tightened late-callback cleanup and capped meter updates.

Final visual verification used a fresh Next.js build cache: review caught an
earlier cached package render, and added exact Listening/Speaking label checks
before rerunning all four widths. Screenshots below the final commit are from
that corrected, exact-pin build.

Remaining: visual approval; real browser microphone/TTS acceptance on target
devices; authenticated non-production conversation/persistence checks. Native
installed iOS/Android live speech remains explicitly unsupported and needs an
approved recognition/output adapter before being advertised. Full duplex,
server audio and attachments are not implemented. No fabricated waveforms or
speech results are used outside clearly labeled deterministic tests.

**OYI FLOATING LIVE VOICE HUB READY FOR VISUAL APPROVAL**
