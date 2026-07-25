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
  /export type CanonicalDevicePresentation[\s\S]*availabilityReason[\s\S]*assignment[\s\S]*roomName[\s\S]*summary/,
  "Consumer must type and preserve the canonical device presentation contract",
);
expect(
  "src/lib/deviceRuntimeContract.ts",
  /state\.residual_electricity[\s\S]*battery_value/,
  "Consumer fallback normalization must understand Tuya residual_electricity battery values",
);
expect(
  "src/lib/devicePresentation.ts",
  /LockKeyholeOpen[\s\S]*lockState\.includes\("unlock"\)[\s\S]*getDeviceIconTone\(device[\s\S]*provider_disconnected[\s\S]*batteryLevel === "critical"/,
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
  "src/app/components/remotes/DoorPanel.tsx",
  /LockKeyhole[\s\S]*LockKeyholeOpen[\s\S]*Remote unlock is unavailable through this connection[\s\S]*Check lock health/,
  "DoorPanel must show a clean state-first Smart Access surface with unavailable remote control explained",
);
expect(
  "src/app/devices/DevicesClient.tsx",
  /pickRoomName\(d: AnyDevice, runtime[\s\S]*presentation\?\.assignment\?\.roomName[\s\S]*runtimeActivitySummary\(device, contract/,
  "Device lists must use presentation assignment and summaries instead of stale local room/status guesses",
);
reject(
  "src/app/components/remotes/DoorPanel.tsx",
  /Check lock health[\s\S]{0,260}Check lock health/,
  "DoorPanel must keep one health entry point",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /operation_matrix[\s\S]*provider-declared only/,
  "DoorPanel health details must summarize the Smart Access operation matrix",
);
reject(
  "src/lib/consumerAwareness.ts",
  /reported a new device update/,
  "Consumer awareness should not surface generic provider-update wording",
);
reject(
  "src/lib/deviceRuntimeContract.ts",
  /Device reported a new device update|Device state is available/,
  "Runtime contract must not surface generic device-update summaries",
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
