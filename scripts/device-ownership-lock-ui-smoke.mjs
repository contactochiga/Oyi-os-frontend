import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function expect(file, pattern, message) {
  const body = read(file);
  if (!pattern.test(body)) failures.push(`${file}: ${message}`);
}

expect(
  "src/app/devices/DevicesClient.tsx",
  /type DeviceRendererKind = "switch" \| "socket" \| "tv" \| "ac" \| "ir" \| "lock" \| "unsupported"/,
  "device drawer must include a first-class lock renderer kind",
);
expect(
  "src/app/devices/DevicesClient.tsx",
  /renderer === "lock" \? <DoorPanel/,
  "lock devices must render DoorPanel, not IR/setup fallback",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /unlock_confirmed: !nextLocked/,
  "unlock command must send explicit confirmation metadata",
);
expect(
  "src/services/socket.ts",
  /export function replaceSocketScope[\s\S]*scope:replace/,
  "Consumer must replace active socket scope on home switch",
);
expect(
  "src/app/components/ContextIsolationBridge.tsx",
  /replaceSocketScope\(\{ estate_id: activeContext\.estate_id, home_id: activeContext\.home_id \}\)/,
  "Context switch must drive socket scope replacement",
);
expect(
  "src/services/integrationsService.ts",
  /TUYA_SYNC_STORAGE_KEY}:\$\{activeContextStorageSuffix\(\)\}/,
  "Tuya sync summary cache must be active-context scoped",
);

if (failures.length) {
  console.error("Device ownership lock UI smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Device ownership lock UI smoke passed.");
