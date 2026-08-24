import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const aiPage = fs.readFileSync(path.join(root, "src/app/ai/page.tsx"), "utf8");
const devicesClient = fs.readFileSync(path.join(root, "src/app/devices/DevicesClient.tsx"), "utf8");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const turnContext = aiPage.match(/function turnScopedAiContext[\s\S]*?function replyFromResponse/)?.[0] || "";
const sendBlock = aiPage.match(/async function handleSend[\s\S]*?async function copyResponse/)?.[0] || "";

check("main AI broad home turns clear stale exact targets", () => {
  assert.match(aiPage, /function isBroadHomeReadPrompt/);
  assert.match(turnContext, /operational_object: null/);
  assert.match(turnContext, /target: null/);
  assert.match(turnContext, /active_intelligence_context: null/);
  assert.match(turnContext, /scope_mode_hint: "home_scope"/);
});

check("main AI broad turns clear selected subobject and visible state", () => {
  assert.match(turnContext, /selected_subobject: null/);
  assert.match(turnContext, /visible_state: null/);
  assert.match(turnContext, /context_id: null/);
  assert.match(turnContext, /context_version: null/);
});

check("turn-scoped context is used for typed and voice submissions", () => {
  assert.match(sendBlock, /const turnContext = turnScopedAiContext\(command, context as Record<string, any>\)/);
  assert.match(sendBlock, /aiService\.chat\(command,\s*\{\s*\.\.\.turnContext,\s*thread_id/);
});

check("exact drawer quick actions keep immutable exact target contract", () => {
  assert.match(devicesClient, /immutable_drawer_target/);
  assert.match(devicesClient, /scope_mode_hint: "exact_target"/);
  assert.match(devicesClient, /operation_class_hint: "read"/);
  assert.match(devicesClient, /target_type: targetContract\.object_type/);
});

check("drawer selected channel identity remains canonical", () => {
  assert.match(devicesClient, /object_type: "device_channel"/);
  assert.match(devicesClient, /canonical_id: `\$\{deviceId\}:\$\{commandCode\}`/);
  assert.match(devicesClient, /channel_code: commandCode/);
});

console.log("intelligence-turn-context-smoke passed");
