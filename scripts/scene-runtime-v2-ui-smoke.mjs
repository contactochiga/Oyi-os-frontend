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
  ["automation runtime ready wording", "Scheduled automations use Runtime V2"],
  ["mobile flex viewport root", "flex h-[100dvh] min-h-0 flex-col overflow-hidden"],
  ["safe area top fallback", "max(env(safe-area-inset-top), 16px)"],
  ["safe area bottom fallback", "max(env(safe-area-inset-bottom), 14px)"],
  ["scrollable middle region", "min-h-0 flex-1 overflow-y-auto overscroll-contain"],
  ["iOS momentum scrolling", "[-webkit-overflow-scrolling:touch]"],
  ["collapsed unavailable devices", "Unavailable in {tab === \"automations\" ? \"automations\" : \"scenes\"}"],
  ["secondary scene ideas", "Scene ideas"],
  ["disabled save name reason", "Add a scene name."],
  ["disabled save action reason", "Select at least one device action."],
  ["device name in selected action labels", "sceneActionLabel"],
  ["selected action stale validation", "invalidSelections"],
  ["backend validation issue highlighting", "validationIssue"],
  ["chip focuses selected device", "focusSelection"],
  ["duplicate device-channel key", "selectionKey(device_id, command_code)"],
  ["pre-save capability refresh", "refreshDevices"],
  ["forced runtime refresh before save", "getRuntimeDevices(homeId, { force: true })"],
  ["capability checking save state", "Checking actions..."],
];

const requiredService = [
  ["scene run result type", "SceneRunResult"],
  ["scene run endpoint", "/run"],
  ["scene run history endpoint", "/runs"],
  ["action labels", "action_label"],
  ["sanitized create payload log", "scene_create_request_payload"],
  ["structured create rejection log", "scene_create_rejected_response"],
  ["validation exposed channel keys", "exposed_channel_keys"],
  ["validation runtime freshness", "runtime_freshness"],
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

if (scenePage.includes("h-[calc(100dvh-var(--sat))]") || scenePage.includes("fixed inset-x-0 bottom-0")) {
  console.error("Scene Runtime V2 UI smoke failed: mobile scene surfaces still use calculated scroll height or fixed bottom footer.");
  process.exit(1);
}

const editorIndex = scenePage.indexOf("function SceneEditor");
const resultIndex = scenePage.indexOf("function SceneResultSurface");
for (const [label, start, end] of [
  ["editor", editorIndex, resultIndex],
  ["result", resultIndex, scenePage.indexOf("function Metric")],
]) {
  const source = start >= 0 && end > start ? scenePage.slice(start, end) : "";
  if (!source.includes("<header") || !source.includes("<main") || !source.includes("<footer")) {
    console.error(`Scene Runtime V2 UI smoke failed: ${label} surface does not use header/main/footer flex siblings.`);
    process.exit(1);
  }
  if (source.includes("fixed inset-x-0 bottom-0") || source.includes("h-[calc(100dvh")) {
    console.error(`Scene Runtime V2 UI smoke failed: ${label} surface regressed to overlay footer/manual height.`);
    process.exit(1);
  }
}

const itemsIndex = scenePage.indexOf("items.map");
const ideasIndex = scenePage.indexOf("Scene ideas");
if (itemsIndex < 0 || ideasIndex < 0 || ideasIndex < itemsIndex) {
  console.error("Scene Runtime V2 UI smoke failed: scene ideas/templates must render after the user's existing scenes.");
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
