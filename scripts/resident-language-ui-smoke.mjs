import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const devicesClient = fs.readFileSync(path.join(root, "src/app/devices/DevicesClient.tsx"), "utf8");
const aiPage = fs.existsSync(path.join(root, "src/app/ai/page.tsx"))
  ? fs.readFileSync(path.join(root, "src/app/ai/page.tsx"), "utf8")
  : "";

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("classified command errors prefer safe backend language", () => {
  assert.match(devicesClient, /body\.safe_error_message \|\| body\.details \|\| body\.error/);
  assert.doesNotMatch(devicesClient.match(/async function sendDeviceCommand[\s\S]*?async function saveDeviceSchedule/)?.[0] || "", /setErr\(e\?\.response\?\.data\?\.error \|\| e\?\.message \|\| "Command failed"/);
});

check("IR command transport stays explicit and provider ack is not physical confirmation", () => {
  assert.match(devicesClient, /commandTransport: "ir"/);
  assert.match(devicesClient, /provider_ack_is_physical_confirmation: false/);
});

check("selected device and channel remain authoritative in Consumer context", () => {
  assert.match(devicesClient, /type DrawerConversationTarget/);
  assert.match(devicesClient, /object_type: "device_channel"/);
  assert.match(devicesClient, /canonical_id: `\$\{deviceId\}:\$\{commandCode\}`/);
  assert.match(devicesClient, /scope_mode_hint: "exact_target"/);
});

check("AI page supports non-action informational states", () => {
  assert.match(aiPage, /informational/);
  assert.match(aiPage, /report_ready/);
  assert.doesNotMatch(aiPage, /Everything responded normally/);
});

console.log("resident-language-ui-smoke passed");
