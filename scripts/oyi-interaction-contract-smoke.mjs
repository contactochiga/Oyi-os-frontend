// Oyi shared interaction foundation -- cross-surface contract smoke.
//
// BYTE-IDENTICAL in Consumer and Facility. Both surfaces consume ONE package
// (oyi-interaction, pinned by commit SHA). This proves, inside each surface's
// own install, that the same canonical response fixture produces the same
// interaction state and action truth, and that no surface keeps a private
// copy of the truth mapper.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const pkgDir = path.dirname(require.resolve("oyi-interaction/package.json"));
const core = await import("oyi-interaction/core");
const { computeInteractionExpectations } = await import("oyi-interaction/fixtures/expectations-lib.mjs");
const fixture = JSON.parse(fs.readFileSync(path.join(pkgDir, "fixtures/oyi-action-truth.fixture.json"), "utf8"));
const expected = JSON.parse(fs.readFileSync(path.join(pkgDir, "fixtures/oyi-interaction-expectations.json"), "utf8"));

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("the surface depends on the shared package by pinned commit", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const spec = String(manifest.dependencies?.["oyi-interaction"] || "");
  assert.ok(spec, "oyi-interaction dependency missing");
  if (process.env.OYI_INTERACTION_ALLOW_LOCAL !== "1") assert.match(spec, /^git\+https:\/\/github\.com\/contactochiga\/oyi-interaction\.git#[0-9a-f]{40}$/, "must pin a full commit SHA");
});

check("no surface-private truth mapper or fixture copy remains", () => {
  for (const file of ["src/lib/oyiActionTruth.ts", "lib/oyiActionTruth.ts", "src/lib/oyiActionTruth.fixture.json", "lib/oyiActionTruth.fixture.json"]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must be removed after adoption`);
  }
});

check("canonical status vocabulary equals the Backend contract", () => {
  assert.deepEqual([...core.OYI_ACTION_STATUSES].sort(), [...fixture.canonical_statuses].sort());
});

check("the same canonical fixture yields the committed interaction state + action truth", () => {
  assert.deepEqual(computeInteractionExpectations(core, fixture), expected);
});

for (const item of expected.cases) {
  check(`${item.id} (${item.matrix}) truth rules`, () => {
    if (!item.action) {
      assert.ok(["idle"].includes(item.phase), "no action -> no action phase");
      return;
    }
    assert.equal(item.action.verified, item.action.status === "confirmed", "only canonical confirmed is verified");
    assert.equal(item.phase === "action_verified", item.action.status === "confirmed");
    if (!item.action.verified) assert.doesNotMatch(`${item.action.headline} ${item.action.detail}`, /\b(completed|success(ful)?|done)\b|(?<!not )\bverified the\b/i);
    if (item.action.status === "awaiting_confirmation") assert.match(item.action.detail, /Nothing has been sent yet\./);
    if (["unobservable", "provider_accepted"].includes(item.action.status)) assert.match(item.action.detail, /has not verified|could not verify/);
    assert.equal(item.restored_action_equal, true, "restored thread presents the live truth");
  });
}

const digest = crypto.createHash("sha256");
for (const rel of ["package.json", "dist/core/index.js", "dist/core/actionTruth.js", "dist/core/interactionState.js", "dist/index.js", "dist/styles/oyi-interaction.css", "fixtures/oyi-interaction-expectations.json"]) digest.update(fs.readFileSync(path.join(pkgDir, rel)));
console.log(`oyi-interaction ${JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")).version} digest ${digest.digest("hex")}`);
console.log("OYI INTERACTION CROSS-SURFACE CONTRACT PASSED");
