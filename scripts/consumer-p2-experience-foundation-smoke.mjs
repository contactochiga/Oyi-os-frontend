import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  nav,
  modules,
  utilities,
  spaces,
  devices,
  room,
  contextual,
  reports,
  shell,
  cameras,
  home,
  scenes,
  wallet,
  security,
  chatFooter,
  composerRow,
  vercelConfig,
] = await Promise.all([
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
  source("src/app/home/page.tsx"),
  source("src/app/scenes/page.tsx"),
  source("src/app/wallet/page.tsx"),
  source("src/app/security/page.tsx"),
  source("src/app/components/ChatFooter.tsx"),
  source("src/app/components/OyiComposerRow.tsx"),
  source("vercel.json"),
]);

assert.match(nav, /\["home", "spaces", "devices", "community", "activity"\]/, "footer nav group 1 must be restored");
assert.match(nav, /\["visitors", "wallet", "maintenance", "services", "profile"\]/, "footer nav group 2 must be restored");
assert.doesNotMatch(modules, /key: "utilities"/, "Utilities must not remain a Consumer menu destination");
assert.match(utilities, /router\.replace\("\/services"\)/, "legacy Utilities links must resolve to Services");
assert.match(spaces, /RoomsClient/, "Spaces must remain the canonical room collection");
assert.match(devices, /\/room\?roomId=/, "Devices by room must resolve to canonical Room detail");
assert.match(room, /ContextualOyiButton label=\{`Ask about \$\{title\}`\}/, "Room Oyi entry must use a resident label");
assert.doesNotMatch(room, /\{vendor\}/, "Room rows must not expose provider labels");
assert.match(contextual, /text\(search.get\("roomName"\)\)/, "Oyi labels must not fall back to Room IDs");
assert.match(contextual, /label \|\| "Ask Oyi"/, "global Oyi access must stay compact");
assert.match(shell, /hideStrip = true/, "dashboard strips must be opt-in");
assert.match(reports, /\/wallet\?transactionId=/, "receipt rows must open real Wallet records");
assert.match(reports, /\/maintenance\?requestId=/, "maintenance rows must open real Maintenance records");
assert.match(cameras, /cameraService\.listByHome\(active\.home_id\)/, "P1 camera scope must remain canonical");

// Generic header subtitles removed (P2 mobile-fixes correction)
assert.match(shell, /\{subtitle \? \(/, "ConsumerShell must only render a subtitle when one is explicitly provided");
assert.doesNotMatch(shell, /Your living environment\./, "ConsumerShell must not force a generic default subtitle");

// Room bulk control is a single power switch, not admin-style buttons
assert.doesNotMatch(room, /Turn on \{compatibleCount\} compatible/, "room bulk power control must not use admin-style buttons");
assert.match(room, /toggleAll\(summary\.anyOn === 0\)/, "room must expose a single power switch derived from room state");

// Room device rows must navigate to the canonical device surface (no second remote)
assert.match(room, /router\.push\(`\/devices\?deviceId=\$\{encodeURIComponent\(sid\)\}`\)/, "room device rows must open the canonical device surface");
assert.doesNotMatch(room, /Status only/, "room device rows must not use a dead-end status-only label");

// Scenes must open the list first; only explicit create actions may deep-link into the editor
assert.match(devices, /onClick=\{\(\) => router\.push\("\/scenes"\)\}[^>]*><Moon/, "Devices nav must open the Scenes list, not jump straight into creation");
assert.doesNotMatch(home, /href: "\/scenes\?create=scene"/, "Home must not jump straight into Scene creation");
assert.doesNotMatch(home, /router\.push\("\/scenes\?create=scene"\)/, "Home quick control must not jump straight into Scene creation");
assert.match(devices, /onCreateScene=\{\(device\) => router\.push\(`\/scenes\?create=scene&deviceId=/, "explicit create-scene-with-device action must still deep-link into the editor");
assert.match(scenes, /params\.get\("create"\) === "scene"/, "Scenes page must still honor an explicit create deep link");

// Wallet balance must be the prominent, honest primary element
assert.match(wallet, /Available balance/i, "Wallet must present the balance as primary information");
assert.match(wallet, /Balance unavailable/, "Wallet must show a truthful unavailable state instead of fabricating ₦0");

// Security hero must be compact, not a large bordered dashboard hero
assert.doesNotMatch(security, /Resident-visible security devices and visitor access stay here\./, "Security hero copy must be removed");

// Device conversation composer must reuse the shared canonical composer (no double border, no orb)
assert.match(devices, /<OyiComposerRow/, "device conversation must reuse the shared composer component");
assert.doesNotMatch(devices, /OyiHubOrb/, "device composer must not render an Oyi orb inside the input row");
assert.match(chatFooter, /<OyiComposerRow/, "main Oyi conversation must reuse the shared composer component");
assert.match(composerRow, /border border-white\/10/, "shared composer must render exactly one boundary");

// Static-export RSC payload files must not be servable as a document response
assert.match(vercelConfig, /"missing": \[\{ "type": "header", "key": "rsc" \}\]/, "vercel.json must block direct document navigation to *.txt RSC payloads");

console.log("consumer P2 experience foundation smoke passed");
