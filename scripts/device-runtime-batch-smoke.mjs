#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const checks = [];
const check = (passed, label) => checks.push([Boolean(passed), label]);
const devicesSource = await readFile(new URL("../src/app/devices/DevicesClient.tsx", import.meta.url), "utf8");
const roomsSource = await readFile(new URL("../src/app/rooms/RoomsClient.tsx", import.meta.url), "utf8");
const serviceSource = await readFile(new URL("../src/services/deviceService.ts", import.meta.url), "utf8");

const deviceHydration = devicesSource.match(/async function hydrateStates[\s\S]*?async function hydrateDeviceIntelligence/)?.[0] || "";
const roomHydration = roomsSource.match(/async function hydrate\(\)[\s\S]*?void hydrate\(\);/)?.[0] || "";

check(serviceSource.includes('API.get("/devices/runtime"'), "device service uses the canonical runtime dashboard endpoint");
check(deviceHydration.includes("getRuntimeDevices(homeId)"), "Devices page hydrates from one home-scoped runtime request");
check(!deviceHydration.includes("getDeviceState("), "Devices list hydration performs no per-device state requests");
check(roomHydration.includes("getRuntimeDevices(homeId)"), "Spaces page hydrates from one home-scoped runtime request");
check(!roomHydration.includes("Promise.all(targets.map"), "Spaces page no longer fans out state requests");
check(devicesSource.includes('include: ["intelligence"]'), "opened device explicitly requests optional intelligence");

for (const [passed, label] of checks) console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([passed]) => !passed)) process.exit(1);
