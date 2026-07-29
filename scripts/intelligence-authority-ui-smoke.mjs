import fs from "fs";
import assert from "assert";

const read = (file) => fs.readFileSync(file, "utf8");
const aiPage = read("src/app/ai/page.tsx");
const aiService = read("src/services/aiService.ts");
const oyiService = read("src/services/oyiService.ts");
const contextStore = read("src/store/useActiveIntelligenceContextStore.ts");
const devicesClient = read("src/app/devices/DevicesClient.tsx");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("Consumer response state contract avoids generic read-only success", () => {
  assert.match(aiPage, /informational/);
  assert.match(aiPage, /report_ready/);
  assert.match(aiPage, /recommendation/);
  assert.match(aiPage, /action_confirmed/);
  assert.doesNotMatch(aiPage.match(/function responseState[\s\S]*?function awarenessCards/)?.[0] || "", /return "success"/);
});

check("read-only answers are not rendered as action success", () => {
  assert.match(aiPage, /executionStatus === "read_only"/);
  assert.match(aiPage, /operationClass === "read"/);
  assert.match(aiPage, /return "informational"/);
});

check("report rendering maps to report_ready state", () => {
  assert.match(aiPage, /resp\.display_mode === "report"/);
  assert.match(aiPage, /return "report_ready"/);
});

check("exact context handoff carries active intelligence context and visible state", () => {
  assert.match(aiPage, /active_intelligence_context: currentRegisteredContext/);
  assert.match(aiPage, /conversation_context:\s*{/);
  assert.match(aiPage, /visible_state: currentRegisteredContext\?\.visible_state/);
  assert.match(oyiService, /active_intelligence_context: input\.active_intelligence_context/);
});

check("context service exposes canonical response context to the UI", () => {
  assert.match(aiService, /context\?: Record<string, any>/);
  assert.match(aiService, /context: resp\?\.context/);
});

check("one turn updates one pending assistant message", () => {
  assert.match(aiPage, /const pendingId = createId\(\)/);
  assert.match(aiPage, /baseMessages\.map\(\(item\) => item\.id === pendingId/);
  assert.doesNotMatch(aiPage, /nextMessages\.push\(\{ role: "assistant"/);
});

check("active context includes versioned visible state for broad and exact scope", () => {
  assert.match(contextStore, /context_version/);
  assert.match(contextStore, /visible_state/);
  assert.match(contextStore, /primary_object/);
});

check("device drawer preserves immutable selected target for typed voice and quick actions", () => {
  assert.match(devicesClient, /type DrawerConversationTarget/);
  assert.match(devicesClient, /drawerConversationTarget/);
  assert.match(devicesClient, /makeDrawerIntelligenceContext/);
  assert.match(devicesClient, /immutable_drawer_target/);
  assert.match(devicesClient, /submitted_target_id/);
});

check("quick action requests send structured read exact-target hints", () => {
  assert.match(devicesClient, /intentHintForPrompt/);
  assert.match(devicesClient, /operation_class_hint: "read"/);
  assert.match(devicesClient, /scope_mode_hint: "exact_target"/);
  assert.match(devicesClient, /target_type: targetContract\.object_type/);
});

check("device channel identity is not flattened to parent device", () => {
  assert.match(contextStore, /device_channel: "device_channel"/);
  assert.match(devicesClient, /object_type: "device_channel"/);
  assert.ok(devicesClient.includes("canonical_id: `${deviceId}:${commandCode}`"));
});

console.log("intelligence-authority-ui-smoke passed");
