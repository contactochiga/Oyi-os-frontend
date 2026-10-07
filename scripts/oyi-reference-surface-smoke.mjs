import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const page = read("src/app/ai/page.tsx");
const css = read("src/app/ai/oyi-reference.css");
const pkg = JSON.parse(read("package.json"));
const installed = JSON.parse(fs.readFileSync(createRequire(import.meta.url).resolve("oyi-interaction/package.json"), "utf8"));
function check(name, run) { run(); console.log(`PASS ${name}`); }
check("reference mounts shared presentation, never shadow primitives", () => {
  for (const name of ["OyiShell", "OyiComposer", "OyiCaption", "OyiSuggestions", "OyiHistory", "OyiOrb", "OyiConfirmation", "OyiActionResult", "OyiNotice"]) {
    assert.match(page, new RegExp(`<${name}\\b`));
    assert.doesNotMatch(page, new RegExp(`function ${name}\\(`));
  }
  assert.equal(installed.version, "0.3.0");
  assert.match(pkg.dependencies["oyi-interaction"], /#c44fa387550874fdae677c41cb6b54e6ff143812$/);
});
check("navigation is registry-derived; canvas never gets old rail or footer", () => {
  assert.match(page, /const navigation = surfaceAdapter\.navigation\(\)/);
  assert.match(page, /navigation\.map/);
  assert.doesNotMatch(page, /md:left-\[108px\]|<BottomNav|Living intelligence|How can I help\?/);
});
check("hero is not a second microphone; captions are real response content", () => {
  assert.match(page, /<OyiOrb size="large" state=\{orbState\} \/>/);
  assert.match(page, /text: message\.content/);
  assert.match(page, /onStartVoice=\{startVoiceCapture\}/);
  assert.match(page, /voiceAdapterRef\.current\?\.cancelListening\(\)/);
  assert.match(page, /epoch !== audioMeterEpoch\.current/);
  assert.doesNotMatch(page, /Array\.from\(\{ length: 28 \}, \(\) => 0\.2\)/);
});
check("history, confirmation and truth remain on existing governed contracts", () => {
  assert.match(page, /oyiService\.listThreads/);
  assert.match(page, /oyiService\.getThreadMessages\(requestedThreadId\)/);
  assert.match(page, /type: "thread\.restored"/);
  assert.match(page, /workflowOverride: nextWorkflow/);
  assert.match(page, /message !== messages\[messages\.length - 1\]/);
  assert.match(page, /This response could not be saved to History/);
});
check("reference layout uses visual viewport and in-flow shared dock", () => {
  assert.match(css, /height: var\(--vvh, 100dvh\)/);
  assert.match(css, /--oyi-keyboard-inset: 0px/);
  assert.match(css, /min-width: 1024px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /user-select: text/);
});
check("Home adopts only the shared visual identity with original entry route", () => {
  const home = read("src/app/home/page.tsx");
  assert.match(home, /<OyiOrb size="large" state="idle" \/>/);
  assert.match(home, /router\.push\("\/ai\?module=home"\)/);
  assert.match(home, /<BottomNav/);
  for (const name of ["three", "@react-three/fiber", "@react-three/drei"]) assert.equal(pkg.dependencies[name], undefined);
});
console.log("OYI CONSUMER REFERENCE SURFACE PASSED");
