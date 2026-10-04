// Consumer x shared Oyi interaction foundation -- integration smoke (Slice 2).
// Supersedes the Slice 1 surface smoke: the truth mapper now lives in the
// shared package. Proves:
//   1. the REAL Consumer surface adapter (transpiled from source) satisfies
//      the shared contract and only supplies context/navigation/seeds/policy;
//   2. the Consumer integration matrix through the shared reducer, using the
//      canonical Backend fixture (ordinary question, restore, voice,
//      confirmation, cancel, accepted-not-verified, unobservable, verified,
//      failure, permission restriction, history, navigation);
//   3. the AI page is actually wired to the shared foundation and the retired
//      over-claiming / fake-progress copy cannot return.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createTsLoader } from "./oyi-ts-loader.mjs";

const root = process.cwd();
const aiPage = fs.readFileSync(path.join(root, "src/app/ai/page.tsx"), "utf8");
const pkgDir = path.dirname(createRequire(path.join(root, "package.json")).resolve("oyi-interaction/package.json"));
const fixture = JSON.parse(fs.readFileSync(path.join(pkgDir, "fixtures/oyi-action-truth.fixture.json"), "utf8"));
const caseById = (id) => fixture.cases.find((c) => c.id === id);
const core = await import("oyi-interaction/core");
const load = createTsLoader(root, path.join(root, "src"));
const { createConsumerSurfaceAdapter, consumerMessageStateForAction } = load("src/oyi/consumerSurfaceAdapter.ts");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const resident = { id: "u1", role: "resident", permissions: ["homes.read", "devices.read", "devices.control"], permission_scopes: [] };
const adapter = createConsumerSurfaceAdapter({ user: resident, estateId: "e1", homeId: "h1", homeLabel: "A-101", operationalObject: { object_type: "device", canonical_id: "d1" }, voiceEntry: true });

// Mirrors the page's dispatch order for one turn.
function turn(response, events = []) {
  let model = core.createInteractionModel();
  for (const event of [...events, { type: "turn.submitted", turnId: "t" }, { type: "turn.response", turnId: "t", response }, { type: "turn.presented", turnId: "t" }]) model = core.interactionReducer(model, event);
  return core.deriveInteractionView(model);
}

check("adapter: real Consumer adapter passes the shared contract (frozen, no authority fields)", () => {
  assert.equal(adapter.surface, "consumer");
  assert.ok(Object.isFrozen(adapter));
  assert.deepEqual(Object.keys(adapter).sort(), ["context", "historyPolicy", "navigation", "operationalObject", "starterSeeds", "surface", "uiHints"]);
  assert.deepEqual(adapter.context(), { scopeKind: "home", scopeLabel: "A-101", estateId: "e1", homeId: "h1", buildingId: null });
  assert.deepEqual(adapter.historyPolicy, { source: "backend_threads", localFallback: "unsaved_turns_only", maxThreads: 24 });
});

check("navigation adapter: exactly the existing permission-aware registry (visibility, not authority)", () => {
  const { CONSUMER_MODULES, visibleModules } = load("src/lib/moduleRegistry.ts");
  for (const user of [resident, { id: "g", role: "guest", permissions: [], permission_scopes: [] }, { id: "o", role: "owner", permissions: ["wallets.read", "visitors.manage"], permission_scopes: [] }, null]) {
    const expected = visibleModules(user, CONSUMER_MODULES).map((m) => m.key);
    const actual = createConsumerSurfaceAdapter({ user, estateId: null, homeId: null, homeLabel: null, operationalObject: null, voiceEntry: false }).navigation().map((item) => item.key);
    assert.deepEqual(actual, expected, `navigation for ${user?.role || "signed-out"}`);
  }
  const signedOut = createConsumerSurfaceAdapter({ user: null, estateId: null, homeId: null, homeLabel: null, operationalObject: null, voiceEntry: false }).navigation();
  assert.ok(signedOut.length < CONSUMER_MODULES.length, "registry permission filtering is applied");
  assert.equal(signedOut.some((item) => item.key === "devices"), false);
  assert.equal(createConsumerSurfaceAdapter({ user: null, estateId: null, homeId: null, homeLabel: null, operationalObject: null, voiceEntry: false }).context().scopeKind, "none");
});

check("starter seeds come from the adapter and normalize through the shared primitive", () => {
  const items = core.normalizeOyiSuggestions(adapter.starterSeeds(), { source: "seed" });
  assert.ok(items.some((item) => item.kind === "navigate" && item.href === "/scenes"));
  assert.ok(items.some((item) => item.label === "What’s happening?" && item.kind === "prompt"));
});

check("ordinary question -> idle answer, no action, informational", () => {
  const view = turn({ reply: "Your home is quiet.", execution: { status: "read_only", action: null } });
  assert.equal(view.phase, "idle");
  assert.equal(view.canonical.text, "Your home is quiet.");
  assert.equal(consumerMessageStateForAction(view.action), null);
});

const matrix = [
  ["A", "confirmation", "confirmation_required", "approval_required"],
  ["H", "cancel", "action_cancelled", "informational"],
  ["C2", "accepted-not-verified", "action_accepted", "partial"],
  ["E", "unobservable", "action_unobservable", "partial"],
  ["D", "verified fixture", "action_verified", "action_confirmed"],
  ["F", "failure", "action_failed", "action_failed"],
  ["J", "provider rejected", "action_rejected", "action_failed"],
];
for (const [id, label, phase, state] of matrix) {
  check(`${label} (${id}) -> ${phase} / message state ${state}`, () => {
    const view = turn({ reply: `Fixture ${id}`, ...caseById(id).response });
    assert.equal(view.phase, phase);
    assert.equal(consumerMessageStateForAction(view.action), state);
    assert.equal(state === "action_confirmed", view.action?.status === "confirmed", "action_confirmed only for canonical verification");
  });
}

check("permission restriction -> no action outcome, never success", () => {
  const view = turn({ reply: "You can't do that here.", ...caseById("M").response });
  assert.equal(view.action, null);
  assert.equal(view.phase, "idle");
  assert.equal(view.canonical.capability_result, "permission_restricted");
});

check("thread restore -> latest assistant message restores the same truth", () => {
  const rows = [{ role: "user", content: "Turn on", metadata: {} }, { role: "assistant", content: "Accepted", metadata: caseById("E").restored_metadata }];
  const model = core.interactionReducer(core.createInteractionModel(), { type: "thread.restored", latestAssistant: core.latestAssistantMessage(rows) });
  const view = core.deriveInteractionView(model);
  assert.equal(view.phase, "action_unobservable");
  assert.deepEqual(view.action, turn({ reply: "Accepted", ...caseById("E").response }).action);
});

check("voice callback wiring -> listening/interim/final drive the shared state", () => {
  let model = core.createInteractionModel();
  model = core.interactionReducer(model, { type: "voice.listening" });
  assert.equal(core.deriveInteractionView(model).phase, "listening");
  model = core.interactionReducer(model, { type: "voice.interim", text: "turn off" });
  assert.equal(core.deriveInteractionView(model).voice.interim, "turn off");
  model = core.interactionReducer(model, { type: "voice.final", text: "turn off the light" });
  assert.equal(core.deriveInteractionView(model).phase, "idle");
});

check("history -> canonical threads normalized; local fallback kept only for unsaved turns", () => {
  const threads = core.normalizeOyiThreads({ threads: [{ id: "a", title: "Lights", updated_at: "2026-10-01T00:00:00Z" }, { id: "a" }] });
  assert.equal(threads.length, 1);
  assert.match(aiPage, /normalizeOyiThreads\(res\.threads \|\| \[\]\)/);
  // Audited fallback: on-device copy only for signed-out use / unsaved turns.
  assert.match(aiPage, /if \(!\(user as any\)\?\.id \|\| !threadId\) saveJson\(CONVERSATIONS_KEY, next\);/);
  assert.match(aiPage, /if \(!cancelled\) setConversations\(localFallback\);/);
});

check("page is wired to the shared foundation", () => {
  assert.match(aiPage, /from "oyi-interaction"/);
  assert.match(aiPage, /import "oyi-interaction\/styles\.css";/);
  for (const needle of [
    'useOyiInteraction()', 'useOyiConnectivity(dispatchInteraction)', 'orbStateForView(interaction)',
    '{ type: "turn.submitted", turnId }', '{ type: "turn.response", turnId, response: resp }', '{ type: "turn.presented", turnId }', 'type: "turn.failed"',
    '{ type: "voice.listening" }', 'type: "voice.final", text', 'type: "voice.interim", text', 'type: "voice.error"', '{ type: "voice.ended" }',
    'type: "thread.restored", latestAssistant: latestAssistantMessage(rows)', '{ type: "conversation.reset" }',
    '<OyiActionResult view={truthView} showTerminalNote />', '<OyiConfirmation', 'confirmationProposal(confirmation)',
    '<OyiOrb size="large" state={orbState}', 'createConsumerSurfaceAdapter(', 'surfaceAdapter.starterSeeds()', 'role="status" aria-live="polite">{interaction.label}</span>',
  ]) assert.ok(aiPage.includes(needle), `missing wiring: ${needle}`);
  assert.doesNotMatch(aiPage, /@\/lib\/oyiActionTruth/);
  assert.doesNotMatch(aiPage, /function OyiOrb\(/, "local orb replaced by the shared renderer");
});

check("no fake progress stages and no over-claiming copy", () => {
  assert.match(aiPage, /content: OYI_WORKING_TEXT, state: "executing", pending: true/);
  assert.match(aiPage, /replyFromResponse\(resp\) \|\| emptyResponseText\(resp\)/);
  for (const phrase of ['|| "Done."', "thinkingTextFor", "Searching devices…", "Looking through rooms…", "Validating permissions…", "Checking home status…", '"Thinking"', "Action completed", "Action closed", "Command approved and processed.", "Executing command…"]) {
    assert.equal(aiPage.includes(phrase), false, `"${phrase}" must not be presented`);
  }
});

check("legacy confirmation ledger never presents approval as verified success", () => {
  const fn = aiPage.match(/async function decideConfirmation[\s\S]*?async function restoreThreadById/)?.[0] || "";
  assert.doesNotMatch(fn, /"action_confirmed"/);
  assert.match(fn, /Oyi has not verified the result\./);
});

console.log("CONSUMER OYI INTERACTION SURFACE SMOKE PASSED");
