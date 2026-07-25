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
  "src/services/deviceService.ts",
  /getSmartAccess\(deviceId[\s\S]*\/devices\/\$\{encodeURIComponent\(deviceId\)\}\/smart-access/,
  "Consumer must read smart-access truth from the canonical Backend device route",
);
expect(
  "src/services/deviceService.ts",
  /SmartAccessCapabilityStatus[\s\S]*temporarily_unavailable[\s\S]*setup_incomplete[\s\S]*provider_disconnected/,
  "Consumer must preserve typed smart-access capability states",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /deviceService\.getSmartAccess\(deviceId\)/,
  "DoorPanel must fetch the provider-neutral Smart Access profile",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /isSupported\(smartAccess, "media", "live_view"\)/,
  "DoorPanel must only show media when live-view is supported",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /Remote unlock is not supported by this lock/,
  "DoorPanel must fail honestly when unlock is unsupported",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /batteryLow[\s\S]*batteryLabel/,
  "DoorPanel must surface battery-low state",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /unlock_confirmed: !nextLocked/,
  "Unlock commands must include explicit resident confirmation metadata",
);
reject(
  "src/app/components/remotes/DoorPanel.tsx",
  /if \(!runtime\) return true/,
  "DoorPanel must not treat missing runtime as lock-control support",
);

if (failures.length) {
  console.error("Smart Access UI smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Smart Access UI smoke passed.");
