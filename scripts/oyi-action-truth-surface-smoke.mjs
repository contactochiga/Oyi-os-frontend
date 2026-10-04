// Oyi action truth -- Consumer surface wiring (Slice 1).
// The shared mapper's behaviour is proven by oyi-action-truth-contract-smoke;
// this proves the Consumer AI page actually uses it and that the retired
// over-claiming copy cannot return.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const aiPage = fs.readFileSync(path.join(root, "src/app/ai/page.tsx"), "utf8");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("AI page imports the shared action truth mapper", () => {
  assert.match(aiPage, /from "@\/lib\/oyiActionTruth"/);
  assert.match(aiPage, /actionTruthView\(/);
  assert.match(aiPage, /messageStateForActionView\(/);
});

check("response state is decided by canonical action truth first", () => {
  const fn = aiPage.match(/function responseState[\s\S]*?\n}\n/)?.[0] || "";
  assert.ok(fn.indexOf("messageStateForActionView") > 0 && fn.indexOf("messageStateForActionView") < fn.indexOf("execution?.results"));
  assert.doesNotMatch(fn, /\/executed\|state_confirmed\|action_confirmed\/\.test\(executionStatus\)[^\n]*return "action_confirmed"/);
});

check("over-claiming copy is gone", () => {
  for (const phrase of ["Action completed", "Action closed", "Command approved and processed.", "Executing command…", "Confirmation required"]) {
    assert.equal(aiPage.includes(phrase), false, `"${phrase}" must not be presented`);
  }
});

check("terminal action card is green/check only when verified", () => {
  const card = aiPage.match(/function ActionLifecycleCard[\s\S]*?\nfunction ExecutionAccountability/)?.[0] || "";
  assert.match(card, /const verified = status === "confirmed"/);
  assert.match(card, /terminal && verified \? <Check/);
  assert.match(card, /data-action-verified=\{truthView\.verified \? "true" : "false"\}/);
});

check("legacy confirmation ledger never presents approval as verified success", () => {
  const fn = aiPage.match(/async function decideConfirmation[\s\S]*?async function restoreThreadById/)?.[0] || "";
  assert.doesNotMatch(fn, /"action_confirmed"/);
  assert.match(fn, /Oyi has not verified the result\./);
  assert.match(fn, /Cancelled\. Nothing was sent\./);
});

check("restored messages rebuild execution from persisted canonical action", () => {
  assert.match(aiPage, /function restoredExecution/);
  assert.match(aiPage, /metadata\.action && typeof metadata\.action === "object"/);
});

console.log("CONSUMER ACTION TRUTH SURFACE SMOKE PASSED");
