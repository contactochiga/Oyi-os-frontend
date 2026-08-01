import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const aiPage = fs.readFileSync(path.join(root, "src/app/ai/page.tsx"), "utf8");
const oyiService = fs.readFileSync(path.join(root, "src/services/oyiService.ts"), "utf8");
const aiService = fs.readFileSync(path.join(root, "src/services/aiService.ts"), "utf8");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("authenticated history uses Backend thread summaries with message counts", () => {
  assert.match(aiPage, /oyiService\.listThreads/);
  assert.match(aiPage, /messageCount: thread\.message_count \|\| 0/);
  assert.doesNotMatch(aiPage, /setConversations\(localFallback\);\s*return;\s*\}\s*setConversations\(rows\.map/);
  assert.doesNotMatch(aiPage, /"Saved thread"/);
});

check("thread route identity is updated on restore and send", () => {
  assert.match(aiPage, /function setThreadRoute|const setThreadRoute/);
  assert.match(aiPage, /params\.set\("threadId", threadId\)/);
  assert.match(aiPage, /setThreadRoute\(nextThreadId\)/);
  assert.match(aiPage, /setThreadRoute\(conversation\.backendThreadId\)/);
});

check("direct thread route reload restores full Backend messages", () => {
  assert.match(aiPage, /searchParams\.get\("threadId"\)/);
  assert.match(aiPage, /oyiService\.getThreadMessages\(conversation\.backendThreadId\)/);
  assert.match(aiPage, /\(res\.messages \|\| \[\]\)\.map\(messageFromThread\)/);
});

check("new conversation clears conversation-specific active intelligence context", () => {
  assert.match(aiPage, /clearActiveIntelligenceContext\(\)/);
  assert.match(aiPage, /clearPersistedActiveIntelligenceContext\(\)/);
  assert.match(aiPage, /setRegisteredContext\(null\)/);
  assert.match(aiPage, /params\.delete\("contextRef"\)/);
  assert.match(aiPage, /params\.delete\("deviceId"\)/);
});

check("Consumer submits context layers as hints, not final authority", () => {
  assert.match(aiPage, /page_launch_context/);
  assert.match(aiPage, /selected_ui_object/);
  assert.match(aiPage, /current_turn_hints/);
  assert.match(aiPage, /authorised_scope/);
  assert.match(oyiService, /page_launch_context\?:/);
  assert.match(aiService, /page_launch_context/);
});

check("broad prompts become home-scope hints", () => {
  assert.match(aiPage, /device_availability_inventory/);
  assert.match(aiPage, /home_operational_summary/);
  assert.match(aiPage, /scope_mode_hint: "home_scope"/);
  assert.match(aiPage, /inherited_target_cleared: true/);
});

check("voice still uses the canonical handleSend pipeline", () => {
  assert.match(aiPage, /handleSend\(text, \{ fromVoice: true \}\)/);
  assert.doesNotMatch(aiPage, /voice.*oyiService\.chat/s);
});

console.log("conversation-thread-foundation-ui-smoke passed");
