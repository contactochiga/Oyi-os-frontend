import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [nav, modules, utilities, spaces, devices, room, contextual, reports, shell, cameras] = await Promise.all([
  source("src/app/components/BottomNav.tsx"),
  source("src/lib/moduleRegistry.ts"),
  source("src/app/utilities/page.tsx"),
  source("src/app/spaces/page.tsx"),
  source("src/app/devices/DevicesClient.tsx"),
  source("src/app/room/RoomClient.tsx"),
  source("src/app/components/ContextualOyiButton.tsx"),
  source("src/app/reports/page.tsx"),
  source("src/app/components/ConsumerShell.tsx"),
  source("src/app/cameras/page.tsx"),
]);

assert.match(nav, /\["home", "spaces", "devices", "community", "activity"\]/, "footer nav group 1 must be restored");
assert.match(nav, /\["visitors", "wallet", "maintenance", "services", "profile"\]/, "footer nav group 2 must be restored");
assert.doesNotMatch(modules, /key: "utilities"/, "Utilities must not remain a Consumer menu destination");
assert.match(utilities, /router\.replace\("\/services"\)/, "legacy Utilities links must resolve to Services");
assert.match(spaces, /RoomsClient/, "Spaces must remain the canonical room collection");
assert.match(devices, /\/room\?roomId=/, "Devices by room must resolve to canonical Room detail");
assert.match(room, /ContextualOyiButton label=\{`Ask about \$\{title\}`\}/, "Room Oyi entry must use a resident label");
assert.doesNotMatch(room, /\{vendor\}/, "Room rows must not expose provider labels");
assert.match(room, /Turn on \{compatibleCount\} compatible/, "bulk room controls must name compatible targets");
assert.match(contextual, /text\(search.get\("roomName"\)\)/, "Oyi labels must not fall back to Room IDs");
assert.match(contextual, /label \|\| "Ask Oyi"/, "global Oyi access must stay compact");
assert.match(shell, /hideStrip = true/, "dashboard strips must be opt-in");
assert.match(reports, /\/wallet\?transactionId=/, "receipt rows must open real Wallet records");
assert.match(reports, /\/maintenance\?requestId=/, "maintenance rows must open real Maintenance records");
assert.match(cameras, /cameraService\.listByHome\(active\.home_id\)/, "P1 camera scope must remain canonical");
console.log("consumer P2 experience foundation smoke passed");
