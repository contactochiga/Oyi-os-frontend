#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function expect(file, pattern, message) {
  const body = read(file);
  if (!pattern.test(body)) failures.push(`${file}: ${message}`);
}

function reject(file, pattern, message) {
  const body = read(file);
  if (pattern.test(body)) failures.push(`${file}: ${message}`);
}

expect(
  "src/lib/deviceRuntimeContract.ts",
  /export type CanonicalDeviceState[\s\S]*availability[\s\S]*provider_disconnected[\s\S]*setup_incomplete[\s\S]*batteryLevel[\s\S]*executableActions/,
  "Consumer must type the canonical Runtime V2 device-state contract",
);
expect(
  "src/lib/deviceRuntimeContract.ts",
  /state\.residual_electricity[\s\S]*battery_value/,
  "Consumer fallback normalization must understand Tuya residual_electricity battery values",
);
expect(
  "src/lib/devicePresentation.ts",
  /getDeviceIconTone\(device[\s\S]*runtime[\s\S]*provider_disconnected[\s\S]*batteryLevel === "critical"/,
  "Icon tone must respond to canonical availability and critical battery without changing icon families",
);
expect(
  "src/app/devices/DevicesClient.tsx",
  /deviceService\.getRuntimeDevices\(homeId\)/,
  "Devices page must use the home-scoped Runtime V2 inventory",
);
reject(
  "src/app/devices/DevicesClient.tsx",
  /Promise\.all\(\[\s*deviceService\.getAssignedDevices/,
  "Devices page must not merge broad estate inventory into resident rendering",
);
expect(
  "src/app/devices/DevicesClient.tsx",
  /Provider disconnected[\s\S]*Setup incomplete[\s\S]*stale/,
  "Device status copy must distinguish provider disconnect, setup incomplete and stale",
);
expect(
  "src/app/home/page.tsx",
  /deviceService\.getRuntimeDevices\(homeId\)/,
  "Home quick devices must use Runtime V2 for assigned/current devices",
);
expect(
  "src/app/security/page.tsx",
  /deviceService\.getRuntimeDevices\(active\.home_id/,
  "Security devices must be scoped through Runtime V2",
);
expect(
  "src/app/utilities/page.tsx",
  /deviceService\.getRuntimeDevices\(active\.home_id/,
  "Utilities devices must be scoped through Runtime V2",
);
expect(
  "src/app/scenes/page.tsx",
  /const homeId = activeContext\.home_id[\s\S]*deviceService\.getRuntimeDevices\(homeId\)/,
  "Scenes device picker must use active-home Runtime V2 inventory",
);

if (failures.length) {
  console.error("Device enterprise UI smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Device enterprise UI smoke passed.");
