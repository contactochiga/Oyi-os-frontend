import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const root = "src/lib/oyi-camera-core";
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, "utf8"));
assert.equal(manifest.source, "Ochiga-backend/packages/oyi-camera-core/src");
for (const [file, expected] of Object.entries(manifest.hashes)) {
  const actual = crypto.createHash("sha256").update(fs.readFileSync(`${root}/${file}`)).digest("hex");
  assert.equal(actual, expected, `Generated Camera Core drift: ${file}`);
}
console.log("Consumer Camera Core generated distribution verified");
