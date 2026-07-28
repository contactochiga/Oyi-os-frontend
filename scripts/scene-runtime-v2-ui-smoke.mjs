#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scenePage = fs.readFileSync(path.join(root, "src/app/scenes/page.tsx"), "utf8");
const sceneService = fs.readFileSync(path.join(root, "src/services/sceneService.ts"), "utf8");

const requiredPage = [
  ["Runtime V2 normalization", "normalizeRuntimeContract"],
  ["capability-driven options", "sceneActionOptions"],
  ["channel definitions", "channel_definitions"],
  ["explicit presentation state", "ScenePresentation"],
  ["list presentation mode", 'mode: "list"'],
  ["editor presentation mode", 'mode: "editor"'],
  ["saving presentation mode", 'mode: "saving"'],
  ["running presentation mode", 'mode: "running"'],
  ["result presentation mode", 'mode: "result"'],
  ["surface lifecycle cleanup", "useSceneSurfaceLifecycle"],
  ["per-action selection state", "actionSelections"],
  ["multi-channel action key", "selectionKey"],
  ["room grouping", "groupedDevices"],
  ["collapsed device expansion", "expandedDeviceId"],
  ["compact Not included control", "Not included"],
  ["lock safety wording", "Lock actions are unavailable in scenes for safety."],
  ["IR exclusion wording", "TV and IR remote actions are not enabled for scenes in this phase."],
  ["per-action result surface", "SceneResultSurface"],
  ["result Done action", "Done"],
  ["automation scheduler warning", "Automatic execution is not enabled yet."],
];

const requiredService = [
  ["scene run result type", "SceneRunResult"],
  ["scene run endpoint", "/run"],
  ["scene run history endpoint", "/runs"],
  ["action labels", "action_label"],
];

const missing = [
  ...requiredPage.filter(([, needle]) => !scenePage.includes(needle)).map(([label, needle]) => `page ${label}: ${needle}`),
  ...requiredService.filter(([, needle]) => !sceneService.includes(needle)).map(([label, needle]) => `service ${label}: ${needle}`),
];

if (missing.length) {
  console.error("Scene Runtime V2 UI smoke failed. Missing invariants:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

if (/createOpen|setCreateOpen|runResult|setRunResult|selectedIds|setSelectedIds|const \[power/.test(scenePage)) {
  console.error("Scene Runtime V2 UI smoke failed: old global selected-devices/power model is still present.");
  process.exit(1);
}

if (scenePage.includes("SceneResultSurface") && scenePage.includes("SceneEditor") && !scenePage.includes('presentation.mode === "result"') && !scenePage.includes('presentation.mode === "editor"')) {
  console.error("Scene Runtime V2 UI smoke failed: editor/result surfaces are not presentation-gated.");
  process.exit(1);
}

if ((scenePage + sceneService).includes("/services/transactions")) {
  console.error("Scene Runtime V2 UI smoke failed: scene UI references the deprecated generic transactions route.");
  process.exit(1);
}

console.log("Scene Runtime V2 UI smoke passed.");
