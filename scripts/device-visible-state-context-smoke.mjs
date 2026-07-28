#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const deviceClientSource = await readFile(new URL("../src/app/devices/DevicesClient.tsx", import.meta.url), "utf8");
const storeSource = await readFile(new URL("../src/store/useActiveIntelligenceContextStore.ts", import.meta.url), "utf8");
const launcherSource = await readFile(new URL("../src/app/components/ContextualOyiButton.tsx", import.meta.url), "utf8");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error?.message || error}`);
    process.exitCode = 1;
  }
}

check("active context visible state can carry sanitized Runtime V2 provenance", () => {
  for (const token of [
    "source?: string",
    "object_type?: string",
    "object_id?: string",
    "parent_device_id?: string",
    "home_id?: string",
    "estate_id?: string",
    "fetched_at?: string",
    "runtime_timestamp?: string",
    "provider_timestamp?: string",
  ]) {
    assert.ok(storeSource.includes(token), `${token} missing from active context visible_state contract`);
  }
});

check("device panel stores Backend Runtime V2 visible-state snapshots", () => {
  assert.match(deviceClientSource, /source: "device_runtime_v2"/);
  assert.match(deviceClientSource, /object_type: "device"/);
  assert.match(deviceClientSource, /object_id: deviceId/);
  assert.match(deviceClientSource, /canonical_device_id: deviceId/);
  assert.match(deviceClientSource, /runtime_timestamp/);
  assert.match(deviceClientSource, /provider_timestamp/);
  assert.match(deviceClientSource, /supported_controls: intelligenceContext\.supported_controls/);
  assert.match(deviceClientSource, /capability_codes: intelligenceContext\.capability_codes/);
  assert.match(deviceClientSource, /channel_definitions: channelDefinitions/);
  assert.match(deviceClientSource, /provider_ack_is_physical_confirmation: false/);
});

check("device channel context preserves exact channel target and states", () => {
  assert.match(deviceClientSource, /object_type: "device_channel"/);
  assert.match(deviceClientSource, /object_id: `\$\{deviceId\}:\$\{commandCode\}`/);
  assert.match(deviceClientSource, /parent_device_id: deviceId/);
  assert.match(deviceClientSource, /channel_code: commandCode/);
  assert.match(deviceClientSource, /channel_states/);
  assert.match(deviceClientSource, /canonical_id: `\$\{deviceId\}:\$\{commandCode\}`/);
});

check("context launcher persists exact active context before opening Oyi", () => {
  assert.match(launcherSource, /persistActiveIntelligenceContext\(intelligenceContext\)/);
  assert.match(launcherSource, /params\.set\("targetId", object\.canonical_id\)/);
  assert.match(launcherSource, /params\.set\("deviceId", intelligenceContext\.primary_object\.canonical_id\)/);
  assert.match(launcherSource, /params\.set\("channel", String\(intelligenceContext\.selected_subobject\.metadata\.channel_code\)\)/);
});

check("visible-state payload does not intentionally carry raw provider payloads or credentials", () => {
  for (const forbidden of ["raw_provider_payload", "provider_secret", "credential_secret", "access_token"]) {
    assert.doesNotMatch(deviceClientSource, new RegExp(forbidden, "i"), `unexpected sensitive token ${forbidden}`);
  }
});

if (process.exitCode) process.exit(process.exitCode);
