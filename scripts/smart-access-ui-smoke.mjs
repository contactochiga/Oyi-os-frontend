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
  /SmartAccessCapabilityStatus[\s\S]*temporarily_unavailable[\s\S]*setup_incomplete[\s\S]*provider_disconnected[\s\S]*provider_declared_only[\s\S]*mapping_missing[\s\S]*verification_required/,
  "Consumer must preserve typed smart-access capability evidence states",
);
expect(
  "src/services/deviceService.ts",
  /declaredByProvider[\s\S]*readableByOyi[\s\S]*executableByOyi[\s\S]*liveVerified/,
  "Consumer must type evidence booleans from the canonical Backend contract",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /deviceService\.getSmartAccess\(deviceId\)/,
  "DoorPanel must fetch the provider-neutral Smart Access profile",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /isExecutable\(smartAccess, "control", "unlock"\)/,
  "DoorPanel must only enable unlock when Backend marks it executable",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /Remote unlock is unavailable through this connection/,
  "DoorPanel must explain mapping-missing unlock without showing a working action",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /batteryLevel[\s\S]*batteryLabel\(battery, batteryLevel\)/,
  "DoorPanel must surface battery percentage and severity",
);
expect(
  "src/services/deviceService.ts",
  /provider_connection_state[\s\S]*device_reachability[\s\S]*lock_state_freshness[\s\S]*lock_state_confirmed_at[\s\S]*remote_unlock_unavailable_reason/,
  "Consumer smart-access types must preserve the separated Backend lock truth contract",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /providerConnectionState[\s\S]*deviceReachability[\s\S]*lockFreshness[\s\S]*lockLive/,
  "DoorPanel must derive live lock presentation from connection, reachability and freshness together",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /Last known state[\s\S]*Last report is too old to rely on[\s\S]*Lock position unavailable[\s\S]*Reconnect provider to resume live updates/,
  "DoorPanel must not label disconnected, expired or unavailable lock position as live",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /batteryTruthLabel[\s\S]*Battery unavailable[\s\S]*Last reported/,
  "DoorPanel must render battery freshness separately from lock state freshness",
);
expect(
  "src/app/devices/DevicesClient.tsx",
  /renderer !== "lock"[\s\S]*hydrateDeviceIntelligence\(device\)/,
  "Opening a Smart Access panel must avoid the duplicate optional intelligence panel fetch",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /unlock_confirmed: !nextLocked/,
  "Unlock commands must include explicit resident confirmation metadata",
);
reject(
  "src/app/components/remotes/DoorPanel.tsx",
  /pickLocked/,
  "DoorPanel must not default unknown cached lock data to locked/live",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /Temporary access detected[\s\S]*Provider setup is required/,
  "DoorPanel must describe declared-only temporary credentials truthfully",
);
expect(
  "src/app/components/remotes/DoorPanel.tsx",
  /Doorbell capability detected[\s\S]*Event connection is not verified/,
  "DoorPanel must describe declared-only doorbell events truthfully",
);
reject(
  "src/app/components/remotes/DoorPanel.tsx",
  /if \(!runtime\) return true/,
  "DoorPanel must not treat missing runtime as lock-control support",
);
reject(
  "src/app/components/remotes/DoorPanel.tsx",
  /remote_no_dp_key/,
  "DoorPanel must not enable unlock from Tuya provider declaration codes",
);
reject(
  "src/app/components/remotes/DoorPanel.tsx",
  /Temporary codes supported|Doorbell events supported/,
  "DoorPanel must not show provider-declared-only capabilities as supported",
);

if (failures.length) {
  console.error("Smart Access UI smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Smart Access UI smoke passed.");
