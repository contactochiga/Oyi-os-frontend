#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assert(pass, label) {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}`);
  if (!pass) process.exitCode = 1;
}

const nextConfig = read("next.config.js");
const authService = read("src/services/authService.ts");
const login = read("src/app/auth/login/LoginClient.tsx");
const resetPage = read("src/app/auth/reset/ResetPasswordClient.tsx");
const roomsClient = read("src/app/rooms/RoomsClient.tsx");
const roomClient = read("src/app/room/RoomClient.tsx");
const devicesClient = read("src/app/devices/DevicesClient.tsx");
const devicePresentation = read("src/lib/devicePresentation.ts");
const deviceService = read("src/services/deviceService.ts");
const messagesService = read("src/services/messagesService.ts");
const messagesPage = read("src/app/messages/page.tsx");
const presenceBridge = read("src/app/components/PresenceBridge.tsx");
const presenceService = read("src/services/presenceService.ts");
const contextBridge = read("src/app/components/ContextIsolationBridge.tsx");
const communityService = read("src/services/communityService.ts");
const communityPage = read("src/app/community/page.tsx");
const servicesService = read("src/services/servicesService.ts");
const servicesPage = read("src/app/services/page.tsx");
const maintenancePage = read("src/app/maintenance/page.tsx");

assert(!/ignoreDuringBuilds\s*:\s*true/.test(nextConfig), "Next build does not ignore ESLint failures");
assert(!/ignoreBuildErrors\s*:\s*true/.test(nextConfig), "Next build does not ignore TypeScript failures");

assert(/requestPasswordReset/.test(authService) && /\/auth\/password\/forgot/.test(authService), "auth service supports password reset request");
assert(/verifyPasswordReset/.test(authService) && /\/auth\/password\/verify-reset/.test(authService), "auth service supports reset token verification");
assert(/completePasswordReset/.test(authService) && /\/auth\/password\/reset/.test(authService), "auth service supports password reset completion");
assert(/href="\/auth\/reset"/.test(login), "login page links to resident password recovery");
assert(/If that email belongs to an Oyi account/.test(resetPage), "password reset avoids account enumeration copy");
assert(/resetToken/.test(resetPage) && /Back to sign in/.test(resetPage), "password reset supports token callback and return to login");

assert(/useActiveContext/.test(roomsClient) && !/user\.home_id/.test(roomsClient), "RoomsClient uses canonical active context instead of legacy user.home_id");
assert(/getRuntimeDevices\(homeId\)/.test(roomsClient), "RoomsClient hydrates devices from Runtime V2 batch endpoint");
assert(/canPowerControl/.test(roomsClient) && /This device does not expose a simple power control/.test(roomsClient), "RoomsClient validates control availability before generic switch commands");
assert(/activeContextKeyRef/.test(roomClient) && /getRuntimeDevices\(homeId\)/.test(roomClient), "RoomClient guards context switches and hydrates Runtime V2 summaries");
assert(/resolveGangCode/.test(roomClient) && /GangRingSwitch/.test(roomClient), "RoomClient keeps multi-gang controls tied to canonical channel codes");
assert(/switchCommandCodes/.test(devicesClient) && /channel_definitions/.test(devicesClient), "DevicesClient derives switch commands from runtime channel definitions");
assert(/residentItems/.test(devicesClient) && /isTransportHub/.test(devicesClient), "DevicesClient hides configured IR transport hubs from resident presentation lists");
assert(/type: "tv_remote", key, command_key: key/.test(devicesClient) && !/\[keyCode\]: key/.test(devicesClient), "TV controls send canonical remote commands without provider-specific key-code payloads");
assert(/type: "ac_remote", power: nextPower/.test(devicesClient) && /fan_speed: speed/.test(devicesClient), "AC controls send canonical air-conditioner commands");
assert(/\["tv", "television", "projector", "set_top_box", "speaker"\]\.includes\(family\)/.test(devicesClient) && /\["climate", "air_conditioner", "thermostat"\]\.includes\(family\)/.test(devicesClient), "DevicesClient renders canonical television and air-conditioner profiles");
assert(/controlProfile === "television"/.test(devicePresentation) && /controlProfile === "air_conditioner"/.test(devicePresentation), "device presentation recognizes canonical IR child profiles");
assert(/document\.visibilityState === "hidden"\) return 180_000/.test(devicesClient) && /sheetOpen \? 15_000 : 45_000/.test(devicesClient), "device runtime polling is adaptive by active and hidden state");

assert(/startPresenceHeartbeat/.test(presenceBridge) && !/messagesService\.pingPresence/.test(presenceBridge), "PresenceBridge delegates to the shared presence manager");
assert(/let activeCount = 0/.test(presenceService) && /inFlight/.test(presenceService) && /MIN_PING_GAP_MS/.test(presenceService), "presence manager enforces one heartbeat and in-flight ping guard");
assert(/useQueryClient/.test(contextBridge) && /queryClient\.removeQueries/.test(contextBridge), "context isolation clears React Query scoped data on home changes");
assert(/resetRuntimeIntelligence/.test(contextBridge) && /clearEvents/.test(contextBridge), "context isolation resets runtime intelligence and event stores");

assert(/throw normalizeDeviceListError/.test(deviceService), "device discovery failures are not returned as empty device lists");
assert(/return \{ error: pickError\(err,\s*"Failed to load messages"\) \} as any/.test(messagesService), "message inbox failures return typed errors instead of empty lists");
assert(/activeContextKeyRef/.test(messagesPage) && /setActiveThread\(null\)/.test(messagesPage), "messages clear stale context on active-home changes");
assert(/throwCommunityError/.test(communityService), "community feed failures throw typed errors instead of empty lists");
assert(/loadRequestRef/.test(communityPage) && /setComments\(\{\}\)/.test(communityPage), "community feed clears stale posts and comments on active-home changes");
assert(/Failed to load service activity/.test(servicesService), "service payment history failures are surfaced");
assert(/setRegistry\(null\)/.test(servicesPage) && /activeContext\.contextKey/.test(servicesPage), "services clear stale registry and account state on active-home changes");
assert(/ServiceApiFailure/.test(servicesService) && /diagnostics/.test(servicesService), "service API failures preserve typed diagnostics");
assert(/\/services\/electricity\/quote/.test(servicesService) && /\/services\/electricity\/purchase/.test(servicesService), "electricity API uses canonical quote and purchase endpoints");
assert(/Infrastructure services are temporarily unavailable\. Try again\./.test(servicesPage), "services page distinguishes backend failure from unconfigured services");
const electricityHandler = servicesPage.match(/if \(item\.key === "electricity"\) \{[\s\S]*?return;\n    \}/)?.[0] || "";
assert(/setPurchaseOpen\(true\)/.test(electricityHandler) && !/initiateTransaction|\/services\/transactions/.test(electricityHandler), "electricity card action cannot use legacy service transaction endpoint");
assert(/requestSeqRef/.test(servicesPage) && /requestSeq !== requestSeqRef\.current/.test(servicesPage), "services page rejects late responses after active-home changes");
assert(/function residentState/.test(servicesPage) && /return \{ label: "Connected"/.test(servicesPage), "services page shows configured identifiers separately from provider readiness");
assert(!/Configured by Facility; provider integration pending/.test(servicesPage), "services page no longer exposes provider-readiness copy on resident cards");
assert(/SERVICE_CARDS\.filter\(\(item\) => isProvisioned\(item\)\)/.test(servicesPage), "services readiness count is based on provisioned home services");
assert(/maintenanceService\.listMyTickets\(\{ homeId: activeContext\.home_id/.test(maintenancePage), "maintenance list is scoped to active home");
assert(/requestRef/.test(maintenancePage) && /setSelectedTicket\(null\)/.test(maintenancePage), "maintenance clears stale tickets on active-home changes");
