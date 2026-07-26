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
check(serviceSource.includes("releaseDeviceView") && serviceSource.includes('state/view/release'), "device service can explicitly release Runtime V2 panel leases");
check(serviceSource.includes("runtimeDevicesCache") && serviceSource.includes("RUNTIME_DEVICES_DEDUPE_MS"), "runtime dashboard requests are deduped per active home");
check(serviceSource.includes("deviceStateInFlight") && serviceSource.includes('includeValues.includes("intelligence") ? "panel"'), "panel state reads are deduped and intelligence reads acquire the panel lease contract");
check(serviceSource.includes("deviceViewReleaseInFlight"), "panel view release calls are deduped to avoid React remount release storms");
check(deviceHydration.includes("getRuntimeDevices(homeId)"), "Devices page hydrates from one home-scoped runtime request");
check(!deviceHydration.includes("getDeviceState("), "Devices list hydration performs no per-device state requests");
check(!/sheetOpen \? 15_000 : 45_000/.test(devicesSource), "Devices page does not poll runtime faster while a panel is open");
check(devicesSource.includes("releaseDeviceView(deviceId)"), "closing an opened device panel releases its logical Runtime V2 lease");
check(roomHydration.includes("getRuntimeDevices(homeId)"), "Spaces page hydrates from one home-scoped runtime request");
check(!roomHydration.includes("Promise.all(targets.map"), "Spaces page no longer fans out state requests");
check(devicesSource.includes('include: ["intelligence"], view: "panel"'), "opened device explicitly requests optional intelligence with one panel view lease");
check(devicesSource.includes('getDeviceState(sid, { view: "panel" })'), "device details modal uses the canonical panel view contract");

for (const [passed, label] of checks) console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([passed]) => !passed)) process.exit(1);
