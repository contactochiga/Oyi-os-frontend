// Oyi action truth -- cross-surface contract smoke.
//
// BYTE-IDENTICAL in Consumer and Facility. Runs the surface's copy of the
// shared mapper (oyiActionTruth.ts) over the Backend-generated contract
// fixture (oyiActionTruth.fixture.json, copied from Ochiga-backend
// docs/contracts/oyi-action-truth.fixture.json) and asserts the truth rules
// every surface must present identically.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");

const mapperPath = ["src/lib/oyiActionTruth.ts", "lib/oyiActionTruth.ts"].map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
assert.ok(mapperPath, "shared mapper oyiActionTruth.ts not found");
const fixturePath = path.join(path.dirname(mapperPath), "oyiActionTruth.fixture.json");
const source = fs.readFileSync(mapperPath, "utf8");
const fixtureText = fs.readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText);

const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const { actionTruthView, conversationActionFrom, messageStateForActionView, OYI_ACTION_STATUSES } = mod.exports;

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("mapper status vocabulary equals the Backend canonical OyiActionStatus list", () => {
  assert.deepEqual([...OYI_ACTION_STATUSES].sort(), [...fixture.canonical_statuses].sort());
});

const EXPECT = {
  awaiting_confirmation: { label: "Confirm action?", tone: "awaiting", verified: false, awaiting_user: true, state: "approval_required" },
  approved: { label: "Approved", tone: "progress", verified: false, awaiting_user: false, state: "executing" },
  provider_accepted: { label: "Command accepted", tone: "unverified", verified: false, awaiting_user: false, state: "partial" },
  confirmed: { label: "Verified", tone: "verified", verified: true, awaiting_user: false, state: "action_confirmed" },
  unobservable: { label: "Command accepted", tone: "unverified", verified: false, awaiting_user: false, state: "partial" },
  timed_out: { label: "Not verified", tone: "failed", verified: false, awaiting_user: false, state: "action_failed" },
  failed: { label: "Action failed", tone: "failed", verified: false, awaiting_user: false, state: "action_failed" },
  provider_rejected: { label: "Rejected by provider", tone: "failed", verified: false, awaiting_user: false, state: "action_failed" },
  cancelled: { label: "Cancelled", tone: "closed", verified: false, awaiting_user: false, state: "informational" },
  superseded: { label: "Replaced", tone: "closed", verified: false, awaiting_user: false, state: "informational" },
};

for (const item of fixture.cases) {
  check(`${item.id} (${item.matrix}) ${item.title}`, () => {
    const live = actionTruthView(item.response);
    const restored = actionTruthView(item.restored_metadata);
    const status = item.response.execution.action?.status || null;
    if (!status) {
      assert.equal(live, null, "no action -> no action presentation");
      assert.equal(restored, null);
      assert.equal(messageStateForActionView(live), null);
      return;
    }
    const expected = EXPECT[status];
    assert.ok(expected, `fixture status ${status} has no expectation`);
    assert.equal(live.status, status);
    assert.equal(live.label, expected.label);
    assert.equal(live.tone, expected.tone);
    assert.equal(live.verified, expected.verified);
    assert.equal(live.awaiting_user, expected.awaiting_user);
    assert.equal(messageStateForActionView(live), expected.state);
    // Only canonical "confirmed" is ever presented as verified.
    assert.equal(live.verified, status === "confirmed");
    if (!live.verified) assert.doesNotMatch(`${live.label} ${live.detail}`, /\b(completed|success(ful)?)\b|(?<!not )\bverified the\b/i);
    if (status === "unobservable" || status === "provider_accepted") assert.match(live.detail, /not verified|could not verify/i);
    // Restoration presents exactly what the live turn presented.
    assert.deepEqual(restored, live);
  });
}

check("unknown or hostile actions present nothing (never success)", () => {
  assert.equal(actionTruthView({ execution: { action: { action_id: "a", status: "success" } } }), null);
  assert.equal(actionTruthView({ execution: { action: { action_id: "a", status: "executed" } } }), null);
  assert.equal(actionTruthView({ execution: { status: "executed" } }), null);
  assert.equal(actionTruthView({ action: { status: "confirmed" } }), null);
  assert.equal(conversationActionFrom(null), null);
});

const digest = (text) => crypto.createHash("sha256").update(text).digest("hex");
console.log(`mapper sha256 ${digest(source)}`);
console.log(`fixture sha256 ${digest(fixtureText)}`);
console.log("OYI ACTION TRUTH CROSS-SURFACE CONTRACT PASSED");
