# Minimal floating voice Orb — visual approval

2026-10-08. No merge or deployment initiated. Intelligence Quality, Backend,
Facility, Office and the original Consumer/Twin worktrees remain untouched.

## Revisions and scope

- Consumer start: `61e79930a410a5c4aee5207db44efec0a028ed10`, clean,
  `codex/oyi-consumer-reference-slice3`.
- Shared start: `2326e20011420c3194c2e8c1eeff5186b88828dd`, clean, v0.6.0.
- Shared final: `03d58e83d567f688d0de3d9b214e6a874838023a`, v0.7.0,
  `codex/oyi-composer-refinement`. Consumer pins this exact HTTPS Git revision.
- The Consumer commit containing this document records the final integration.

Before-reference: the existing v0.6 implementation and its committed
`artifacts/oyi-live-voice` fixture captures. No new attached reference image was
visible in this task. Prior evidence is preserved unchanged.

## Changes

The shared `OyiLiveVoiceHub` now renders only the existing 56px Orb and a short,
selectable, live-announced status. Its background, border, shadow, padding,
waveform, title and microphone/close controls are removed. The floating unit
has a 16px gap above the composer and is 80px tall in ordinary listening state.
In short viewports the same Orb scales to 40px rather than disappearing.

The composer waveform entry becomes its single End/X control during a session.
End remains enabled when offline or working. With a typed draft, Send is still
present and separate from End; the normal inactive composer is unchanged.
The one-shot microphone is disabled and explicitly labeled unavailable while
Live Voice is active. Escape also ends the session and returns focus to input.

Errors/pauses are never hidden: short captions show Voice interrupted, Voice
unavailable, Voice paused or Connection interrupted. The native **Voice details**
disclosure exposes the complete original error/reason, with optional explicit
Resume inside it. It is collapsed by default and has no card container.
No success or delivery status is inferred from the visual cleanup.

Shared `onEndLiveVoice` is additive. Existing unused hub callback/level props
remain accepted for source compatibility. Future hosts adopting this version
must wire the composer End callback. No Facility/Office package pin changed.

Consumer only rewires the shared controls and stops allocating the now-unused
live amplitude meter. One-shot metering remains. Recognition, speech output,
canonical request, thread persistence, action confirmation/truth and the shared
voice-session state machine are unchanged. No new audio provider or endpoint.
The React review ensured accessible details, a reachable End control during
disabled/working states, and no unused live animation/capture workload.

## Validation

| Check | Result |
|---|---|
| Shared `npm run check` | PASS: typecheck, build, guards/firewall, dist parity, expectations, 73 tests |
| Old non-live host renders vs v0.6 | PASS: 62 Orb/composer/shell comparisons |
| Installed dist vs reviewed shared build | PASS: 61 byte-identical files |
| Consumer `npx tsc --noEmit` | PASS |
| Consumer `npm run build` | PASS: `/ai` 27.7 kB, first-load 174 kB, unchanged at displayed precision |
| Consumer `npm run lint` | PASS: 0 errors, 41 existing warnings |
| `node scripts/oyi-live-voice-smoke.mjs` | PASS: 6 tests |
| `npm run smoke:oyi-composer-voice` | PASS: 17 tests |
| Built-app browser fixture suite | PASS: 62 checks at 390/768/1024/1440 |
| Relevant Consumer smoke families | 14 PASS; 1 known historical FAIL |
| Diff and changed-file secret scan | PASS before commit |

Browser command:

```sh
PLAYWRIGHT_MODULE=/tmp/oyi-browser-tools.f6p0jz/node_modules/playwright/index.mjs node scripts/oyi-reference-browser.mjs
```

The suite checks transparent/no-border/no-shadow styling, no hub controls,
one composer End, Orb centering and gap, no panel-sized empty space, unchanged
composer bounds, typed Send, microphone abort on End, short captions/full error
details, permission recovery, hidden/offline pause, late callback protection,
request once-only behavior, thread reuse, confirmation, action-unobservable
truth, one-shot speech behavior, reduced motion, viewport/safe-area layout,
and absence of console/hydration errors or unexpected external requests.

Passing smoke families: reference surface, shared interaction contract, action
truth surface, final correction, thread foundation, intelligence authority,
turn context, device visible state, command truth, context isolation, membership
source-of-truth, Consumer P2 foundation, resident language and scene runtime v2.
The pre-existing `contextual-intelligence-smoke.mjs` failure still expects
removed `ContextualOyiButton` markup. Its expectation was not weakened.

## Screenshots — controlled synthetic fixtures, not production

| Width | Empty live composer | Speaking / typed draft | Short viewport | Collapsed error | Error details |
|---|---|---|---|---|---|
| 390 | [view](../artifacts/oyi-minimal-voice/390-live-empty-fixture.png) | [view](../artifacts/oyi-minimal-voice/390-live-speaking-fixture.png) | [view](../artifacts/oyi-minimal-voice/390-live-keyboard-muted-fixture.png) | [view](../artifacts/oyi-minimal-voice/390-live-permission-error-fixture.png) | [view](../artifacts/oyi-minimal-voice/390-live-error-details-fixture.png) |
| 768 | [view](../artifacts/oyi-minimal-voice/768-live-empty-fixture.png) | [view](../artifacts/oyi-minimal-voice/768-live-speaking-fixture.png) | [view](../artifacts/oyi-minimal-voice/768-live-keyboard-muted-fixture.png) | [view](../artifacts/oyi-minimal-voice/768-live-permission-error-fixture.png) | [view](../artifacts/oyi-minimal-voice/768-live-error-details-fixture.png) |
| 1024 | [view](../artifacts/oyi-minimal-voice/1024-live-empty-fixture.png) | [view](../artifacts/oyi-minimal-voice/1024-live-speaking-fixture.png) | [view](../artifacts/oyi-minimal-voice/1024-live-keyboard-muted-fixture.png) | [view](../artifacts/oyi-minimal-voice/1024-live-permission-error-fixture.png) | [view](../artifacts/oyi-minimal-voice/1024-live-error-details-fixture.png) |
| 1440 | [view](../artifacts/oyi-minimal-voice/1440-live-empty-fixture.png) | [view](../artifacts/oyi-minimal-voice/1440-live-speaking-fixture.png) | [view](../artifacts/oyi-minimal-voice/1440-live-keyboard-muted-fixture.png) | [view](../artifacts/oyi-minimal-voice/1440-live-permission-error-fixture.png) | [view](../artifacts/oyi-minimal-voice/1440-live-error-details-fixture.png) |

## Remaining limitations

Real microphone/browser speech-service acceptance and authenticated test-Backend
validation were not performed. These are controlled local browser/media/API
fixtures, not customer data or live physical actions. Native iOS/Android speech
remains unsupported. Keyboard evidence uses reduced visual viewport geometry,
not a physical device keyboard. Facility/Office app builds were not rerun;
shared compatibility and realtime firewall were tested without touching them.

**OYI MINIMAL FLOATING VOICE HUB READY FOR APPROVAL.**
