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
  securityStateLib,
  communityUnreadLib,
  sceneServiceSrc,
  visitors,
  doorPanel,
  hamburgerMenu,
  deviceServiceSrc,
  activityServiceSrc,
  aiPage,
  proximityPage,
  supportPage,
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
  source("src/lib/securityState.ts"),
  source("src/lib/communityUnread.ts"),
  source("src/services/sceneService.ts"),
  source("src/app/visitors/page.tsx"),
  source("src/app/components/remotes/DoorPanel.tsx"),
  source("src/app/components/HamburgerMenu.tsx"),
  source("src/services/deviceService.ts"),
  source("src/services/activityService.ts"),
  source("src/app/ai/page.tsx"),
  source("src/app/profile/proximity/page.tsx"),
  source("src/app/support/page.tsx"),
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

// Canonical Consumer header: fixed position, hamburger + title on one row,
// circular icon badges, no solid full-bleed background bar — matching the
// Devices/Profile reference exactly, shared via ConsumerShell for every
// page that uses it (not hand-rolled per page).
assert.match(shell, /fixed inset-x-0 z-\[80\]/, "ConsumerShell header must use the canonical fixed positioning");
assert.doesNotMatch(shell, /stickyHeader/, "sticky header must be the shell's default behavior, not an opt-in prop");
assert.doesNotMatch(shell, /bg-\[#03070c\]\/96/, "ConsumerShell header must not keep the old solid dark background bar");
assert.match(shell, /ResizeObserver/, "ConsumerShell must measure its own header height so content never hides underneath it");
assert.match(roomsClient, /fixed inset-x-0 z-\[80\]/, "Spaces header must use the same canonical fixed positioning as every other module");
assert.match(scenes, /fixed inset-x-0 z-\[80\]/, "Scenes header must use the same canonical fixed positioning as every other module");
assert.doesNotMatch(scenes, /Run safe, home-scoped device actions together/, "Scenes must not keep the old generic subtitle");

// Profile header adopts the canonical hamburger+title row
assert.match(profile, /<h1 className="truncate text-\[24px\][^>]*>Profile<\/h1>/, "Profile title must move into the fixed header row");

// Connected Systems / Support no longer carry generic subtitles
assert.doesNotMatch(devices, /subtitle="Manage device providers/, "Connected Systems must not keep a generic subtitle");

// Home operating strip must be truth-driven, never a fabricated default
assert.doesNotMatch(home, /oyi:last-scene|oyi:scene-activated/, "Home must not trust a device-local scene cache as authority");
assert.match(home, /sceneService\.listSceneRuns\(scene\.id\)/, "Home's last-scene value must come from real, Home-scoped run history");
assert.match(home, /scenes\.length \? "No scene run" : "No scenes yet"/, "Home must show a truthful empty state instead of a fabricated scene name");
assert.doesNotMatch(sceneServiceSrc, /oyi:last-scene|oyi:scene-activated/, "sceneService must not write scene state to localStorage");
assert.match(home, /resolveSecurityState\(assignedDevices, activeVisitors, devicesBusy\)/, "Home's Security value must come from the shared security-state resolver");
assert.doesNotMatch(home, /activeVisitors \? `\$\{activeVisitors\} visitor/, "Home must not restate the visitor count as the Security value");
assert.match(home, /countUnreadCommunityUpdates\(notificationStoreItems, communityLocalReadIds\)/, "Home's Community value must be a real unread count, not a raw post total");
assert.match(home, /\$\{activeDevices\}\/\$\{totalVisibleDevices\} online/, "Home's Devices value must show active/total, not treat registered as online");
assert.match(securityStateLib, /export function resolveSecurityState/, "a shared security-state resolver must exist for Home and Security to share");
assert.match(security, /resolveSecurityState\(devices, activeVisitors\.length, loading\)/, "the Security page itself must use the shared resolver");
assert.match(communityUnreadLib, /export function countUnreadCommunityUpdates/, "a shared community-unread resolver must exist for Home and Community to share");

// Messages: no card-in-card nesting, composer is a single thin border
assert.doesNotMatch(messages, /rounded-3xl border border-white\/10 bg-white\/5/, "Messages must not wrap the list/conversation in a heavy outer card");
assert.doesNotMatch(messages, /rounded-\[24px\] border border-white\/10 bg-black\/25/, "Messages composer must not nest a second bordered input card");
assert.match(messages, /Type a message/, "Messages composer copy must remain unchanged");

// Services: one truthful status pill per card, no simultaneous Connected + Setup required
assert.doesNotMatch(services, /disabled=\{busy \|\| !actionEnabled\}/, "service cards must not render a separate disabled status button");
assert.match(services, /onClick=\{\(\) => \(actionEnabled \? onAction\(\) : onExplain\(explanation\)\)\}/, "the whole service card must be tappable, resolving to either the real action or a truthful explanation");
assert.match(services, /const statusLabel = actionEnabled/, "service state must resolve to one authoritative label shared by the pill and the tap explanation");

// Closure pass: visitor detail must not swallow a real backend failure into
// a UI-side generic message -- the truthful error text comes from the
// service layer's mapped/backend message, not a hardcoded fallback.
assert.match(visitors, /visitorService\.getInfo\(id\)/, "visitor detail must call the real getInfo service");
assert.doesNotMatch(visitors, /catch \{\s*setInfoErr\(["'`]Visitor could not be verified/, "visitor detail open must not hardcode a blanket verification-failure message over every error");

// Closure pass: visitor status pills must never wrap to a second line
assert.match(visitors, /whitespace-nowrap/, "visitor status pill must be non-wrapping");
assert.match(visitors, /inline-flex shrink-0 items-center gap-1 whitespace-nowrap/, "visitor status Pill component must be shrink-proof so it never wraps under card pressure");

// Closure pass: Room master switch must sit on the same row as the
// online/offline/active summary line (not floating against a taller
// two-line block that also contains Refresh), with an explicit ON/OFF label,
// and Refresh must not be visually confusable with the toggle.
assert.match(room, /\{summary\.anyOn > 0 \? "ON" : "OFF"\}/, "Room switch must show an explicit ON/OFF text state, not just a color change");
assert.match(room, /<div className="flex items-center justify-between gap-3">\s*<div className="min-w-0 text-sm text-white\/60 truncate">/, "Room switch and the online/offline/active summary must share one row so the switch aligns with room state, not the Refresh button below it");

// Closure pass: smart-access/lock capability surfaces must keep showing the
// backend's real, per-capability reason -- never claim full lock control
// exists when the provider mapping is unverified.
assert.match(doorPanel, /function capabilityNote/, "DoorPanel must keep its capability-note truthful-blocker helper");
assert.match(doorPanel, /evidence\.status === "verification_required"/, "DoorPanel must surface the verification_required blocker truthfully");
assert.match(doorPanel, /evidence\.status === "mapping_missing"/, "DoorPanel must surface the mapping_missing blocker truthfully");

// Final closure pass: Favorites -- one canonical merged source (runtime truth
// + registry-stored favorite preference) shared by Home and Devices, never
// two independent favorite states.
assert.match(deviceServiceSrc, /async getRuntimeDevicesWithPreferences/, "deviceService must expose one canonical runtime+favorite-preference merge function");
assert.match(deviceServiceSrc, /favorite: savedFavorite\(registry\)/, "the merge must read the favorite flag from the registry row, not fabricate it");
assert.match(home, /getRuntimeDevicesWithPreferences\(estateId, homeId\)/, "Home must load devices through the canonical favorite-aware merge");
assert.match(devices, /getRuntimeDevicesWithPreferences\(estateId, homeId\)/, "Devices must load devices through the same canonical favorite-aware merge as Home");
assert.match(home, /favoritePreference\(device\) === true/, "Home favorites must gate on the real favorite flag");
assert.match(devices, /Boolean\(device\?\.favorite \|\| device\?\.is_favorite \|\| device\?\.pinned/, "Devices favorite check must read the same underlying flags as Home");

// Devices: category rail matches the requested minimal set, Edit Favorites
// only while Favorites is selected, no standalone Activity shortcut, no
// permanent "Favorite Controls" block, no Devices-by-Room duplication of Spaces.
assert.match(devices, /\{ key: "all", label: "All" \}/, "Devices category rail must include All");
assert.match(devices, /\{ key: "favorites", label: "Favorites" \}/, "Devices category rail must include Favorites");
assert.doesNotMatch(devices, /Favorite Controls/, "Devices must not keep a permanent standalone Favorite Controls block");
assert.doesNotMatch(devices, /No favorite controls yet/, "Devices must not keep a permanent standalone empty-favorites block");
assert.doesNotMatch(devices, /Devices by Room/, "Devices must not duplicate Spaces' room navigation");
assert.match(devices, /category === "favorites" \? \(/, "Edit favorites action must only render while the Favorites category is selected");
assert.doesNotMatch(devices, /router\.push\("\/activity"\)\}[^<]*className="inline-flex items-center gap-1 text-xs text-sky-200\/80">Activity/, "Devices must not keep a standalone Activity shortcut duplicating the Activity module");
assert.match(devices, /openAddDevice/, "Add Device must stay reachable from the device-navigation area");

// Room: reusable master switch is truthful, never hidden inconsistently,
// disabled (not absent) when a room has zero controllable devices, and
// every device row opens its real control surface via the canonical resolver.
assert.match(room, /disabled=\{busyId === "room-all" \|\| loading \|\| compatibleCount === 0\}/, "room switch must be a truthful disabled state when no device is controllable, not hidden");
assert.doesNotMatch(room, /\{compatibleCount \? \(\s*<button/, "room switch must not be conditionally unmounted based on compatible device count");
assert.match(room, /openCanonicalDevice\(router, sid\)/, "every room device row must open its real control surface via the shared canonical resolver");
assert.match(room, /backHref="\/spaces"/, "Room header must provide real back navigation to Spaces");

// Proximity Awareness: dedicated page reuses the real proximityService (no
// duplicate settings store), and the old profile in-panel implementation is
// gone rather than left as an unreachable duplicate.
assert.match(proximityPage, /proximityService\.getSettings\(/, "Proximity Awareness page must read real stored settings via proximityService");
assert.match(proximityPage, /proximityService\.updateSettings\(/, "Proximity Awareness page must persist changes via the real service");
assert.match(proximityPage, /oyi:proximity-settings-changed/, "Proximity Awareness page must keep dispatching the shared settings-changed event GeoFenceBridge listens for");
assert.doesNotMatch(profile, /panel === "proximity"/, "profile page must not keep an unreachable duplicate Proximity Awareness panel");
assert.match(profile, /router\.push\("\/profile\/proximity"\)/, "Profile's Proximity Awareness menu item must open the dedicated canonical page");

// Help & Support: routes to the real existing /support page, not a dead
// in-panel duplicate with mismatched destinations, and not a nonexistent
// /help or /docs route.
assert.doesNotMatch(profile, /panel === "support"/, "profile page must not keep an unreachable duplicate Help & Support panel");
assert.match(profile, /item\.key === "support" \? router\.push\("\/support"\)/, "Profile's Help & Support menu item must open the real, existing /support page");
assert.doesNotMatch(supportPage, /href="\/help"|href="\/docs"|router\.push\("\/help"\)|router\.push\("\/docs"\)/, "Help & Support must not link to a nonexistent /help or /docs route");

// Reports -> Oyi proactive intelligence: removed as a primary hamburger
// destination without deleting the underlying report capability/route/API,
// and report-type notifications deep-link into the Oyi conversation surface
// instead of forcing a standalone Reports dashboard.
assert.doesNotMatch(hamburgerMenu, /"reports"/, "Reports must be removed from the primary hamburger destination list");
assert.match(modules, /key: "reports", label: "Reports", href: "\/reports"/, "the Reports module route and permission gate must remain registered, not deleted");
assert.match(reports, /maintenanceService\.listMyTickets|servicesService\.history|listMyNotifications/, "the underlying Reports archive data (maintenance/payments/activity) must remain real, not deleted");
assert.match(activityServiceSrc, /\/report\|briefing\|digest\//, "report/briefing-type notifications must be detected for proactive Oyi routing");
assert.match(activityServiceSrc, /href: `\/ai\$\{reportThreadId/, "report-type notifications must deep-link into the Oyi conversation surface, not a standalone Reports dashboard");
assert.match(aiPage, /restoreThreadById/, "the Oyi Command Center must keep its real threadId restore path that report notifications rely on");

// Responsive navigation: one shared ITEMS/NAV_GROUPS source of truth presented
// as phone bottom nav and iPad+ left sidebar, not two independent nav systems.
assert.match(nav, /md:flex/, "BottomNav must render a persistent sidebar variant at the md breakpoint");
assert.match(nav, /md:hidden/, "the phone bottom nav must hide at the md breakpoint in favor of the sidebar, not stack both");
assert.match(shell, /backHref \? \(/, "ConsumerShell must support an optional back-navigation affordance for detail pages");
for (const [name, src] of [["home", home], ["devices", devices], ["profile", profile], ["ai", aiPage], ["rooms", roomsClient], ["scenes", scenes]]) {
  assert.match(src, /md:left-\[88px\]/, `${name} page must offset its fixed layout for the iPad+ sidebar width`);
}

console.log("consumer P2 experience foundation smoke passed");
