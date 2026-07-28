#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const objectContextSource = await readFile(new URL("../src/services/operationalObjectContext.ts", import.meta.url), "utf8");
const oyiServiceSource = await readFile(new URL("../src/services/oyiService.ts", import.meta.url), "utf8");
const deviceClientSource = await readFile(new URL("../src/app/devices/DevicesClient.tsx", import.meta.url), "utf8");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error?.message || error}`);
    process.exitCode = 1;
  }
}

check("Consumer route context derives device, room, maintenance, wallet, service and community targets", () => {
  for (const token of ["deviceId", "roomId", "requestId", "transactionId", "serviceId", "postId"]) {
    assert.match(objectContextSource, new RegExp(token));
  }
  assert.match(objectContextSource, /source: "consumer_route_context"/);
});

check("Consumer Oyi runtime conversation sends operational object and target", () => {
  assert.match(oyiServiceSource, /API\.post\("\/oyi\/runtime\/conversation"/);
  assert.match(oyiServiceSource, /operational_object: input\.operational_object \|\| null/);
  assert.match(oyiServiceSource, /target: input\.target \|\| null/);
});

check("Device intelligence context includes exact channel definitions and scene automation relationships", () => {
  assert.match(deviceClientSource, /channel_definitions: intelligenceContext\.channel_definitions/);
  assert.match(deviceClientSource, /active_scenes: intelligenceContext\.active_scenes/);
  assert.match(deviceClientSource, /active_automations: intelligenceContext\.active_automations/);
});

check("Consumer service uses Oyi Core language and avoids new runtime naming", () => {
  assert.doesNotMatch(oyiServiceSource, /Onea|Ocity|Ogconnect/);
});

if (process.exitCode) process.exit(process.exitCode);
