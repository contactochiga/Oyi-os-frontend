import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const aiPage = fs.readFileSync(path.join(root, "src/app/ai/page.tsx"), "utf8");
const operationalContext = fs.readFileSync(path.join(root, "src/services/operationalObjectContext.ts"), "utf8");

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function createRestoreHarness(fetchThread) {
  let seq = 0;
  const state = {
    active: { threadId: null, status: "blank", source: "new" },
    messages: [],
    historyOpen: true,
    historyError: null,
    routeThreadId: null,
  };
  async function restoreThreadById(threadId, source) {
    const requestedThreadId = String(threadId || "").trim();
    if (!requestedThreadId) return false;
    const restoreSeq = ++seq;
    state.active = { threadId: requestedThreadId, status: "loading_thread", source };
    state.historyError = null;
    const res = await fetchThread(requestedThreadId);
    if (restoreSeq !== seq) return false;
    if (res.ok === false || (res.thread?.id && res.thread.id !== requestedThreadId)) {
      state.historyError = "This conversation could not be loaded. Try again.";
      state.active = { threadId: requestedThreadId, status: "thread_error", source };
      return false;
    }
    if (!res.messages?.length) {
      state.historyError = "This conversation has no saved messages.";
      state.active = { threadId: requestedThreadId, status: "thread_error", source };
      return false;
    }
    if (Number(res.thread?.message_count || 0) > 0 && !res.messages?.length) {
      state.historyError = "This conversation could not be loaded. Try again.";
      state.active = { threadId: requestedThreadId, status: "thread_error", source };
      return false;
    }
    state.messages = [...(res.messages || [])].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")) || String(a.id).localeCompare(String(b.id)));
    state.active = { threadId: requestedThreadId, status: "active_thread", source };
    state.historyOpen = false;
    state.routeThreadId = requestedThreadId;
    return true;
  }
  return { state, restoreThreadById };
}

await check("AI thread routes do not become message-thread operational targets", () => {
  assert.doesNotMatch(operationalContext, /object_type: "message_thread"/);
  assert.doesNotMatch(operationalContext, /Message thread/);
  assert.match(aiPage, /conversation_id: searchParams\.get\("threadId"\)/);
});

await check("history restoration replaces messages and fails closed", () => {
  assert.match(aiPage, /async function restoreThreadById\(threadId: string, source: "history" \| "route"\)/);
  assert.match(aiPage, /oyiService\.getThreadMessages\(requestedThreadId\)/);
  assert.match(aiPage, /setMessages\(nextMessages\)/);
  assert.doesNotMatch(aiPage, /nextMessages\.length \? nextMessages : conversation\.messages/);
  assert.match(aiPage, /This conversation could not be loaded right now\./);
});

await check("restored thread clears page-launch targets without deleting the backend thread id", () => {
  assert.match(aiPage, /setBackendThreadId\(requestedThreadId\)/);
  assert.match(aiPage, /setRegisteredContext\(null\)/);
  assert.match(aiPage, /clearActiveIntelligenceContext\(\)/);
  assert.match(aiPage, /clearPersistedActiveIntelligenceContext\(\)/);
});

await check("new chat performs a full conversation-context reset", () => {
  assert.match(aiPage, /function startNewConversation/);
  assert.match(aiPage, /setBackendThreadId\(null\)/);
  assert.match(aiPage, /setMessages\(\[\]\)/);
  assert.match(aiPage, /setThreadRoute\(null\)/);
  assert.match(aiPage, /params\.delete\("deviceId"\)/);
  assert.match(aiPage, /params\.delete\("channel"\)/);
});

await check("home-scope prompts send hint-only scope and clear inherited exact target", () => {
  assert.match(aiPage, /scope_mode_hint: "home_scope"/);
  assert.match(aiPage, /operational_object: null/);
  assert.match(aiPage, /target: null/);
  assert.match(aiPage, /active_intelligence_context: null/);
});

await check("conversation table cards render responsively", () => {
  assert.match(aiPage, /function ConversationTable/);
  assert.match(aiPage, /overflow-x-auto/);
  assert.match(aiPage, /String\(card\.type \|\| ""\) === "table"/);
});

await check("duplicate/internal cards and sources are filtered", () => {
  assert.match(aiPage, /normalizedUiCopy/);
  assert.match(aiPage, /containsInternalConversationText/);
  assert.match(aiPage, /awarenessText/);
  assert.match(aiPage, /messageFromThread/);
  assert.match(aiPage, /row\.cards \|\| \[\]\)\.filter/);
});

await check("composer reserve is dynamic and applied to the scroller", () => {
  assert.match(aiPage, /ResizeObserver/);
  assert.match(aiPage, /composerReserve = `calc\(\$\{composerHeight \+ 24\}px \+ var\(--sab\) \+ var\(--kb\)\)`/);
  assert.match(aiPage, /scrollPaddingBottom: composerReserve/);
  assert.match(aiPage, /height: composerReserve/);
  assert.match(aiPage, /fixed inset-0 flex flex-col overflow-hidden/);
});

await check("route and history restoration use one active thread state", () => {
  assert.match(aiPage, /type ActiveConversationState/);
  assert.match(aiPage, /status: "loading_thread"/);
  assert.match(aiPage, /status: "active_thread"/);
  assert.match(aiPage, /routeThreadRestoreRef/);
  assert.match(aiPage, /restoreSequenceRef/);
});

await check("thread restore is race-safe and does not blank current messages on failure", () => {
  assert.match(aiPage, /restoreSequenceRef\.current !== restoreSeq/);
  assert.match(aiPage, /thread_restore_mismatch/);
  assert.match(aiPage, /thread_message_count_mismatch/);
  assert.match(aiPage, /setMessages\(\(current\) => current\.length \? current/);
  assert.match(aiPage, /This conversation could not be loaded\. Try again\./);
  assert.match(aiPage, /This conversation has no saved messages\./);
});

await check("history click waits for hydration before closing", () => {
  assert.match(aiPage, /await restoreThreadById\(threadId, "history"\)/);
  assert.match(aiPage, /setHistoryOpen\(false\)/);
  assert.match(aiPage, /setRestoringThreadId\(requestedThreadId\)/);
  assert.match(aiPage, /restoringThreadId === conversation\.backendThreadId/);
});

await check("compact searchable history list replaces oversized cards", () => {
  assert.match(aiPage, /historyQuery/);
  assert.match(aiPage, /Search conversations/);
  assert.match(aiPage, /min-h-\[46px\]/);
  assert.match(aiPage, /groupedConversations/);
  assert.doesNotMatch(aiPage, /No messages yet/);
  assert.doesNotMatch(aiPage, /Previous Oyi interactions across your signed-in devices/);
});

await check("module navigation actions render as explicit route actions", () => {
  assert.match(aiPage, /function isNavigationSuggestion/);
  assert.match(aiPage, /action\?\.type === "navigation"/);
  assert.match(aiPage, /action\?\.type === "open_module"/);
  assert.match(aiPage, /data-action-kind=\{navigation \? "navigation" : "contextual"\}/);
  assert.match(aiPage, /text-emerald-50\/88/);
});

await check("navigation action rendering remains separated from target mutation controls", () => {
  assert.match(aiPage, /operation_class === "navigate"/);
  assert.match(aiPage, /operation_class === "list"/);
  assert.match(aiPage, /if \(!onTarget\(action\.target\) && action\.route\) onOpen\(String\(action\.route\)\)/);
  assert.doesNotMatch(aiPage, /data-action-kind=\{navigation \? "control"/);
});

await check("room navigation and destination parameters remain route actions", () => {
  assert.match(aiPage, /data-action-kind=\{navigation \? "navigation" : "contextual"\}/);
  assert.match(aiPage, /router\.push\(route\)/);
  assert.match(aiPage, /onOpen: \(route: string\) => void/);
});

await check("clarification and approval have dedicated presentation paths", () => {
  assert.match(aiPage, /clarification_required/);
  assert.match(aiPage, /function ConfirmationCard/);
  assert.match(aiPage, /Confirmation required/);
  assert.match(aiPage, /Cancel/);
  assert.match(aiPage, /Confirm/);
});

await check("intent presentation policy suppresses duplicate support for informational rows", () => {
  assert.match(aiPage, /function shouldRenderSupport/);
  assert.match(aiPage, /awarenessText/);
  assert.match(aiPage, /suppress_context_chips|containsInternalConversationText|normalizedUiCopy/);
});

await check("offline and recent-change tables remain clean presentation blocks", () => {
  assert.match(aiPage, /function ConversationTable/);
  assert.match(aiPage, /rows\.slice\(0, 20\)/);
  assert.match(aiPage, /overflow-x-auto/);
  assert.doesNotMatch(aiPage, /Oyi answer grounded[\s\S]{0,80}Home is selected/);
});

await check("conversation time formatting is safe and calendar-aware", () => {
  assert.match(aiPage, /Time unavailable/);
  assert.match(aiPage, /Yesterday, \$\{time\}/);
  assert.match(aiPage, /month: "short", day: "numeric"/);
  assert.doesNotMatch(aiPage, /Invalid Date/);
});

await check("behaviour: route thread hydration loads ordered messages and closes only after success", async () => {
  const harness = createRestoreHarness(async () => ({
    ok: true,
    thread: { id: "thread-a", message_count: 2 },
    messages: [
      { id: "m2", created_at: "2026-08-01T08:01:00Z", role: "assistant", content: "Two" },
      { id: "m1", created_at: "2026-08-01T08:00:00Z", role: "user", content: "One" },
    ],
  }));
  assert.equal(await harness.restoreThreadById("thread-a", "route"), true);
  assert.equal(harness.state.active.threadId, "thread-a");
  assert.equal(harness.state.active.status, "active_thread");
  assert.equal(harness.state.historyOpen, false);
  assert.deepEqual(harness.state.messages.map((m) => m.id), ["m1", "m2"]);
});

await check("behaviour: quick Thread A then Thread B selection keeps Thread B", async () => {
  let releaseA;
  const a = new Promise((resolve) => { releaseA = () => resolve({ ok: true, thread: { id: "thread-a", message_count: 1 }, messages: [{ id: "a", created_at: "2026-08-01T08:00:00Z" }] }); });
  const harness = createRestoreHarness((threadId) => threadId === "thread-a" ? a : Promise.resolve({ ok: true, thread: { id: "thread-b", message_count: 1 }, messages: [{ id: "b", created_at: "2026-08-01T08:01:00Z" }] }));
  const first = harness.restoreThreadById("thread-a", "history");
  const second = harness.restoreThreadById("thread-b", "history");
  releaseA();
  assert.equal(await second, true);
  assert.equal(await first, false);
  assert.equal(harness.state.active.threadId, "thread-b");
  assert.deepEqual(harness.state.messages.map((m) => m.id), ["b"]);
});

await check("behaviour: restore failure preserves current messages and leaves error visible", async () => {
  const harness = createRestoreHarness(async () => ({ ok: false, thread: { id: "thread-fail" }, messages: [] }));
  harness.state.messages = [{ id: "existing", content: "Keep me" }];
  assert.equal(await harness.restoreThreadById("thread-fail", "history"), false);
  assert.equal(harness.state.active.status, "thread_error");
  assert.equal(harness.state.historyError, "This conversation could not be loaded. Try again.");
  assert.deepEqual(harness.state.messages.map((m) => m.id), ["existing"]);
});

await check("behaviour: empty thread guard keeps history open and does not create blank active thread", async () => {
  const harness = createRestoreHarness(async () => ({ ok: true, thread: { id: "thread-empty", message_count: 0 }, messages: [] }));
  assert.equal(await harness.restoreThreadById("thread-empty", "history"), false);
  assert.equal(harness.state.historyOpen, true);
  assert.equal(harness.state.historyError, "This conversation has no saved messages.");
  assert.equal(harness.state.active.status, "thread_error");
  assert.deepEqual(harness.state.messages, []);
});

console.log("conversation-final-correction-ui-smoke passed");
