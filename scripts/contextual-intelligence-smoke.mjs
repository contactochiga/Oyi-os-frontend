#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const objectContextSource = await readFile(new URL("../src/services/operationalObjectContext.ts", import.meta.url), "utf8");
const oyiServiceSource = await readFile(new URL("../src/services/oyiService.ts", import.meta.url), "utf8");
const deviceClientSource = await readFile(new URL("../src/app/devices/DevicesClient.tsx", import.meta.url), "utf8");
const launcherSource = await readFile(new URL("../src/app/components/ContextualOyiButton.tsx", import.meta.url), "utf8");
const shellSource = await readFile(new URL("../src/app/components/ConsumerShell.tsx", import.meta.url), "utf8");
const scenePageSource = await readFile(new URL("../src/app/scenes/page.tsx", import.meta.url), "utf8");
const aiPageSource = await readFile(new URL("../src/app/ai/page.tsx", import.meta.url), "utf8");

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
  for (const token of ["deviceId", "channel", "roomId", "sceneId", "automationId", "requestId", "transactionId", "receipt", "serviceId", "postId"]) {
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

check("Consumer renders visible contextual Oyi entry points on shell, devices and scenes", () => {
  assert.match(launcherSource, /Ask Oyi about/);
  assert.match(launcherSource, /starter/);
  assert.match(shellSource, /ContextualOyiButton/);
  assert.match(deviceClientSource, /Ask Oyi about devices/);
  assert.match(scenePageSource, /Ask Oyi about/);
});

check("Consumer AI page exposes object-specific starter prompts and target switching", () => {
  assert.match(aiPageSource, /contextualSuggestions/);
  assert.match(aiPageSource, /Why didn’t this run\?/);
  assert.match(aiPageSource, /Explain this transaction\./);
  assert.match(aiPageSource, /deriveConsumerOperationalObject/);
});

check("Consumer service uses Oyi Core language and avoids new runtime naming", () => {
  assert.doesNotMatch(oyiServiceSource, /Onea|Ocity|Ogconnect/);
});

if (process.exitCode) process.exit(process.exitCode);
