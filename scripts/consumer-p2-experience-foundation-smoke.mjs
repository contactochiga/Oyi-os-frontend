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
  messages,
  services,
  profile,
  roomsClient,
  openStore,
  openNav,
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
  source("src/app/messages/page.tsx"),
  source("src/app/services/page.tsx"),
  source("src/app/profile/page.tsx"),
  source("src/app/rooms/RoomsClient.tsx"),
  source("src/store/useDeviceOpenRequestStore.ts"),
  source("src/lib/deviceOpenNavigation.ts"),
]);

assert.match(nav, /\["home", "spaces", "devices", "community", "activity"\]/, "footer nav group 1 must be restored");
assert.match(nav, /\["visitors", "wallet", "maintenance", "services", "profile"\]/, "footer nav group 2 must be restored");
assert.doesNotMatch(modules, /key: "utilities"/, "Utilities must not remain a Consumer menu destination");
assert.match(utilities, /router\.replace\("\/services"\)/, "legacy Utilities links must resolve to Services");
assert.match(spaces, /RoomsClient/, "Spaces must remain the canonical room collection");
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
assert.match(room, /openCanonicalDevice\(router, sid\)/, "room device rows must open the canonical device surface via the shared resolver");
assert.doesNotMatch(room, /Status only/, "room device rows must not use a dead-end status-only label");

// Devices header no longer carries its own Scenes shortcut; Scenes remains a real, separate module
assert.doesNotMatch(devices, /<Moon className="h-3\.5 w-3\.5" \/> Scenes/, "Devices header must not carry a Scenes action");
assert.match(devices, /openAddDevice/, "Devices header must still expose Add Device");
assert.match(scenes, /listScenes|sceneService/, "Scenes module must remain intact and reachable on its own route");

// Scenes must open the list first; only explicit create actions may deep-link into the editor
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

// Room-originated device deep link must open the real control surface, not silently fall into the assign-to-room flow
assert.match(devices, /openDevice\(target, \{ alreadyAssigned: true \}\)/, "Room-originated device deep link must bypass the assign-to-room flow");
assert.match(devices, /options\?\.alreadyAssigned/, "openDevice must support an alreadyAssigned override for canonical home-scoped devices");

// Canonical header pattern: hamburger + title on the same row, no separate subtitle-heavy header block
assert.match(devices, /flex min-w-0 items-center gap-2\.5">\s*<div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white\/10 bg-white\/\[0\.03\][^"]*"><HamburgerMenu \/><\/div>\s*<h1/, "Devices header must place the hamburger and title on the same row");
assert.doesNotMatch(devices, /<header className="flex items-end justify-between gap-3">/, "Devices must not keep a separate scrolled-in header row below the fixed hamburger bar");

// Favorites: Home and Devices must resolve from the same canonical signal,
// with no synthetic fallback that fabricates favorites when none exist
assert.doesNotMatch(home, /hasSavedPreferences/, "Home must not fall back to showing non-favorited devices as if they were favorites");
assert.match(home, /favoritePreference\(device\) === true/, "Home favorites must be gated on the real favorite flag, same as Devices");
assert.match(devices, /category === "favorites"\s*\?\s*isFavoriteDevice\(d\)/, "Devices Favorites filter must use the canonical favorite flag");

// One canonical cross-page device-open resolver, reused by Room and Home
assert.match(openStore, /requestDeviceOpen: \(deviceId: string\) => void/, "a shared device-open-request store must exist");
assert.match(openNav, /export function openCanonicalDevice/, "a shared canonical device-open navigation helper must exist");
assert.match(room, /openCanonicalDevice\(router, sid\)/, "Room must use the shared canonical device-open resolver");
assert.match(home, /openCanonicalDevice\(router, deviceId\)/, "Home favorites must use the shared canonical device-open resolver instead of a bare \/devices push");
assert.doesNotMatch(home, /simple \? void toggleFavoriteDevice\(device\) : router\.push\("\/devices"\)/, "Home favorite tiles must not route a specific device open to the generic Devices landing page");
assert.match(devices, /requestedDeviceId \|\| String\(searchParams\.get\("deviceId"\)/, "Devices must prefer the cross-page store request over the URL param race");
assert.match(devices, /console\.warn\("\[consumer\.devices\] device deep-link target not found"/, "a failed device-open resolution must be logged in development, not silently dropped");

// Devices reorg: no standalone Favorite Controls carousel or Devices-by-Room duplication of Spaces
assert.doesNotMatch(devices, /Favorite Controls/, "Devices must not keep a separate Favorite Controls section (Favorites is a filter now)");
assert.doesNotMatch(devices, /Devices by Room/, "Devices must not duplicate Spaces' room navigation");
assert.match(devices, /key: "favorites", label: "Favorites"/, "Devices category rail must include a real Favorites filter");

// Sticky module header lives in the shared shell, not hand-rolled per page
assert.match(shell, /sticky top-0 z-30/, "ConsumerShell header must be sticky for every page that uses it");
assert.doesNotMatch(shell, /stickyHeader/, "sticky header must be the shell's default behavior, not an opt-in prop");
assert.match(roomsClient, /sticky top-0 z-30/, "Spaces header must be sticky like every other module");

// Profile header adopts the canonical hamburger+title row
assert.match(profile, /<h1 className="truncate text-\[24px\][^>]*>Profile<\/h1>/, "Profile title must move into the fixed header row");

// Messages: no card-in-card nesting, composer is a single thin border
assert.doesNotMatch(messages, /rounded-3xl border border-white\/10 bg-white\/5/, "Messages must not wrap the list/conversation in a heavy outer card");
assert.doesNotMatch(messages, /rounded-\[24px\] border border-white\/10 bg-black\/25/, "Messages composer must not nest a second bordered input card");
assert.match(messages, /Type a message/, "Messages composer copy must remain unchanged");

// Services: one truthful status pill per card, no simultaneous Connected + Setup required
assert.doesNotMatch(services, /disabled=\{busy \|\| !actionEnabled\}/, "service cards must not render a separate disabled status button");
assert.match(services, /onClick=\{\(\) => \(actionEnabled \? onAction\(\) : onExplain\(explanation\)\)\}/, "the whole service card must be tappable, resolving to either the real action or a truthful explanation");
assert.match(services, /const statusLabel = actionEnabled/, "service state must resolve to one authoritative label shared by the pill and the tap explanation");

console.log("consumer P2 experience foundation smoke passed");
