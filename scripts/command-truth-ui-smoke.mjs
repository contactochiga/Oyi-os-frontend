import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const devicesClient = read("src/app/devices/DevicesClient.tsx");
const deviceService = read("src/services/deviceService.ts");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("command response contract includes non-final lifecycle truth", () => {
  for (const token of ["final", "provider_status", "confirmation_status", "physical_effect_status", "final_status", "truth_state", "safe_error_message"]) {
    assert.match(deviceService, new RegExp(token));
  }
});

check("Consumer can recover command status from durable execution endpoint", () => {
  assert.match(deviceService, /getCommandExecution/);
  assert.match(deviceService, /\/oyi\/runtime\/executions\/\$\{encodeURIComponent\(commandExecutionId\)\}/);
  assert.match(devicesClient, /pollCommandExecution/);
});

check("Consumer subscribes to canonical command execution updates", () => {
  assert.match(devicesClient, /command\.execution\.updated/);
  assert.match(devicesClient, /applyCommandExecutionUpdate/);
});

check("switch channel optimistic UI does not overwrite canonical stateMap", () => {
  const toggleStart = devicesClient.indexOf("async function toggleGang");
  const toggleEnd = devicesClient.indexOf("async function toggleMasterPower", toggleStart);
  assert.ok(toggleStart > -1, "toggleGang handler should exist");
  assert.ok(toggleEnd > toggleStart, "toggleMasterPower should follow toggleGang");
  const toggleGangSource = devicesClient.slice(toggleStart, toggleEnd);
  assert.doesNotMatch(toggleGangSource, /setStateMap\(\(p\) => \(\{ \.\.\.p, \[sid\]: \{ \.\.\.\(p\[sid\]/);
  assert.match(devicesClient, /desiredValues\[i\] = pending\.desired_state/);
  assert.match(devicesClient, /Changing… waiting for provider\/state confirmation/);
});

check("failure and timeout rollback remain channel-scoped", () => {
  assert.match(devicesClient, /const channelLabel = `Channel \$\{gangIndex \+ 1\}`/);
  assert.match(devicesClient, /\$\{channelLabel\} command failed/);
  assert.match(devicesClient, /command_status: finalStatus === "confirmation_timed_out" \? "timeout" : "failed"/);
});

console.log("command-truth-ui-smoke passed");
