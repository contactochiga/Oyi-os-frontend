import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const devicesClient = fs.readFileSync(path.join(root, "src/app/devices/DevicesClient.tsx"), "utf8");
const deviceService = fs.readFileSync(path.join(root, "src/services/deviceService.ts"), "utf8");
const tvRenderer = devicesClient.match(/function TVRenderer[\s\S]*?function TvControlGroup/)?.[0] || "";

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("TV buttons submit canonical intent with provider metadata as evidence", () => {
  assert.match(devicesClient, /type:\s*"tv_remote"/);
  assert.match(devicesClient, /command_key:\s*key/);
  assert.match(devicesClient, /provider_key:\s*definition\?\.providerKey/);
  assert.match(devicesClient, /key_id:\s*definition\?\.keyId/);
});

check("Consumer does not decide final provider key identity", () => {
  assert.match(tvRenderer, /definition\?\.providerKey \|\| key/);
  assert.doesNotMatch(tvRenderer, /\[key\]:/);
  assert.doesNotMatch(tvRenderer, /key_id:\s*key/);
});

check("IR tap headers remain explicit and isolated", () => {
  assert.match(devicesClient, /commandTransport:\s*"ir"/);
  assert.match(deviceService, /const isIrCommand = options\.commandTransport === "ir"/);
  assert.match(deviceService, /"X-IR-Tap-Sequence"/);
});

console.log("tv-remote-command-contract-smoke passed");
