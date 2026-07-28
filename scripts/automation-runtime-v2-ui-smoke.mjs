#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "src/app/scenes/page.tsx"), "utf8");
const service = fs.readFileSync(path.join(root, "src/services/sceneService.ts"), "utf8");

const required = [
  ["explicit testing mode", 'mode: "testing"'],
  ["explicit history mode", 'mode: "history"'],
  ["automation test service", "testAutomation(id"],
  ["automation run history service", "listAutomationRuns(id"],
  ["manual test route", "/scenes/automations/${encodeURIComponent(id)}/test"],
  ["run history route", "/scenes/automations/${encodeURIComponent(id)}/runs"],
  ["schedule normalizer", "normalizeAutomationSchedule"],
  ["schedule summary", "scheduleSummary"],
  ["daily schedule option", 'value="daily"'],
  ["weekday schedule option", 'value="weekdays"'],
  ["one-time schedule option", 'value="once"'],
  ["weekday selector", "[\"S\", \"M\", \"T\", \"W\", \"T\", \"F\", \"S\"].map"],
  ["automation test result label", "Automation test"],
  ["automation history surface", "AutomationHistorySurface"],
  ["Runtime V2 ready wording", "Scheduled automations use Runtime V2"],
  ["automation unavailable wording", 'Unavailable in {tab === "automations" ? "automations" : "scenes"}'],
  ["lock exclusion preserved", "Lock actions are unavailable"],
  ["TV/IR exclusion preserved", "TV and IR remote actions are not enabled"],
  ["action editor reused", "SceneEditor"],
  ["no overlapping result/editor state", "resultKind"],
];

const combined = `${page}\n${service}`;
const missing = required.filter(([, needle]) => !combined.includes(needle));
if (missing.length) {
  console.error("Automation Runtime V2 UI smoke failed. Missing invariants:");
  for (const [label, needle] of missing) console.error(`- ${label}: ${needle}`);
  process.exit(1);
}

const unsupportedTriggerLabels = ["Sunrise", "Sunset", "Presence", "Device state", "Manual"];
const exposed = unsupportedTriggerLabels.filter((label) => page.includes(`>${label}<`) || page.includes(`{${JSON.stringify(label)}}`));
if (exposed.length) {
  console.error(`Automation Runtime V2 UI smoke failed. Unsupported trigger options still exposed: ${exposed.join(", ")}`);
  process.exit(1);
}

console.log("Automation Runtime V2 UI smoke passed.");
