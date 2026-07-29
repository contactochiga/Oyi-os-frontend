import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
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

check("TV remote taps are not collapsed by client-side duplicate suppression", () => {
  assert.match(devicesClient, /irTapSequenceRef/);
  assert.match(devicesClient, /const tapSequence = isIrRemoteCommand \? \+\+irTapSequenceRef\.current : undefined/);
  assert.doesNotMatch(devicesClient, /recentRemotePressRef/);
  assert.doesNotMatch(devicesClient, /irSubmissionQueuesRef/);
});

check("TV remote failure stays inside drawer and controls remain mounted", () => {
  assert.match(devicesClient, /const \[remoteError, setRemoteError\]/);
  assert.match(devicesClient, /setRemoteError\(body\.safe_error_message \|\| body\.details \|\| body\.error/);
  assert.match(devicesClient, /This remote command could not be completed/);
  assert.doesNotMatch(devicesClient, /setSheetOpen\(false\)[\s\S]{0,400}remoteStatus === "rejected"/);
});

check("Provider acknowledgement is not rendered as physical TV success", () => {
  assert.match(devicesClient, /Provider acknowledgement confirms dispatch, not physical TV state/);
  assert.match(devicesClient, /Provider acknowledged/);
  assert.doesNotMatch(devicesClient, /TV responded|TV changed|physically succeeded/);
});

console.log("tv-remote-fifo-smoke passed");
