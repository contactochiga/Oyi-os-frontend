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
const deviceService = read("src/services/deviceService.ts");
const messagesService = read("src/services/messagesService.ts");
const messagesPage = read("src/app/messages/page.tsx");
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

assert(/throw normalizeDeviceListError/.test(deviceService), "device discovery failures are not returned as empty device lists");
assert(/return \{ error: pickError\(err,\s*"Failed to load messages"\) \} as any/.test(messagesService), "message inbox failures return typed errors instead of empty lists");
assert(/activeContextKeyRef/.test(messagesPage) && /setActiveThread\(null\)/.test(messagesPage), "messages clear stale context on active-home changes");
assert(/throwCommunityError/.test(communityService), "community feed failures throw typed errors instead of empty lists");
assert(/loadRequestRef/.test(communityPage) && /setComments\(\{\}\)/.test(communityPage), "community feed clears stale posts and comments on active-home changes");
assert(/Failed to load service activity/.test(servicesService), "service payment history failures are surfaced");
assert(/setRegistry\(null\)/.test(servicesPage) && /activeContext\.contextKey/.test(servicesPage), "services clear stale registry and account state on active-home changes");
assert(/maintenanceService\.listMyTickets\(\{ homeId: activeContext\.home_id/.test(maintenancePage), "maintenance list is scoped to active home");
assert(/requestRef/.test(maintenancePage) && /setSelectedTicket\(null\)/.test(maintenancePage), "maintenance clears stale tickets on active-home changes");
