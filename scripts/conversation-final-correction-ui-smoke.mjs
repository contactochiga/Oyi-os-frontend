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

console.log("conversation-final-correction-ui-smoke passed");
