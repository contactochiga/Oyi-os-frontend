import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const aiPage = fs.readFileSync(path.join(root, "src/app/ai/page.tsx"), "utf8");
const operationalContext = fs.readFileSync(path.join(root, "src/services/operationalObjectContext.ts"), "utf8");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("AI thread routes do not become message-thread operational targets", () => {
  assert.doesNotMatch(operationalContext, /object_type: "message_thread"/);
  assert.doesNotMatch(operationalContext, /Message thread/);
  assert.match(aiPage, /conversation_id: searchParams\.get\("threadId"\)/);
});

check("history restoration replaces messages and fails closed", () => {
  assert.match(aiPage, /oyiService\.getThreadMessages\(conversation\.backendThreadId\)/);
  assert.match(aiPage, /setMessages\(nextMessages\)/);
  assert.doesNotMatch(aiPage, /nextMessages\.length \? nextMessages : conversation\.messages/);
  assert.match(aiPage, /This conversation could not be loaded right now\./);
});

check("restored thread clears page-launch targets without deleting the backend thread id", () => {
  assert.match(aiPage, /setBackendThreadId\(conversation\.backendThreadId \|\| null\)/);
  assert.match(aiPage, /setRegisteredContext\(null\)/);
  assert.match(aiPage, /clearActiveIntelligenceContext\(\)/);
  assert.match(aiPage, /clearPersistedActiveIntelligenceContext\(\)/);
});

check("new chat performs a full conversation-context reset", () => {
  assert.match(aiPage, /function startNewConversation/);
  assert.match(aiPage, /setBackendThreadId\(null\)/);
  assert.match(aiPage, /setMessages\(\[\]\)/);
  assert.match(aiPage, /setThreadRoute\(null\)/);
  assert.match(aiPage, /params\.delete\("deviceId"\)/);
  assert.match(aiPage, /params\.delete\("channel"\)/);
});

check("home-scope prompts send hint-only scope and clear inherited exact target", () => {
  assert.match(aiPage, /scope_mode_hint: "home_scope"/);
  assert.match(aiPage, /operational_object: null/);
  assert.match(aiPage, /target: null/);
  assert.match(aiPage, /active_intelligence_context: null/);
});

check("conversation table cards render responsively", () => {
  assert.match(aiPage, /function ConversationTable/);
  assert.match(aiPage, /overflow-x-auto/);
  assert.match(aiPage, /String\(card\.type \|\| ""\) === "table"/);
});

check("duplicate/internal cards and sources are filtered", () => {
  assert.match(aiPage, /normalizedUiCopy/);
  assert.match(aiPage, /containsInternalConversationText/);
  assert.match(aiPage, /awarenessText/);
  assert.match(aiPage, /messageFromThread/);
  assert.match(aiPage, /row\.cards \|\| \[\]\)\.filter/);
});

check("composer reserve is dynamic and applied to the scroller", () => {
  assert.match(aiPage, /ResizeObserver/);
  assert.match(aiPage, /composerReserve = `calc\(\$\{composerHeight \+ 24\}px \+ var\(--sab\) \+ var\(--kb\)\)`/);
  assert.match(aiPage, /scrollPaddingBottom: composerReserve/);
  assert.match(aiPage, /height: composerReserve/);
  assert.match(aiPage, /fixed inset-0 flex flex-col overflow-hidden/);
});

console.log("conversation-final-correction-ui-smoke passed");
