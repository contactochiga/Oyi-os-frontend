// Local presentation validation, NOT authenticated Backend acceptance.
// Uses the built application, existing HTTP contracts and synthetic responses.
// No token is invented. All API requests are intercepted; other origins abort.
// Usage: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/oyi-reference-browser.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = process.cwd();
const output = fs.mkdtempSync(path.join(os.tmpdir(), "oyi-reference-browser-"));
const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath || !path.isAbsolute(modulePath)) throw new Error("Set PLAYWRIGHT_MODULE to an installed local Playwright module. No runtime dependency is added.");
const { chromium } = await import(pathToFileURL(modulePath).href);
const require = createRequire(import.meta.url);
const fixture = JSON.parse(fs.readFileSync(require.resolve("oyi-interaction/fixtures/oyi-action-truth.fixture.json"), "utf8"));
const example = (id) => structuredClone(fixture.cases.find((item) => item.id === id).response);
const exportRoot = path.join(root, "out");
assert.ok(fs.existsSync(path.join(exportRoot, "ai.html")), "Build Consumer first");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = path.resolve(exportRoot, `.${pathname}`);
  if (!file.startsWith(`${exportRoot}/`) && file !== exportRoot) { res.writeHead(403).end(); return; }
  if (pathname === "/") file = path.join(exportRoot, "index.html");
  else if (!path.extname(file)) file += ".html";
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const results = [];
let browserVoiceProbe;
let activePage;
async function check(name, fn) {
  try { await fn(); results.push({ name, status: "PASS" }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: "FAIL", error: error.message }); console.error(`FAIL ${name}: ${error.message}`); throw error; }
}
try {
  const probe = await browser.newPage();
  await probe.goto(`${origin}/voice-probe.html`); // Empty local 404, no application scripts.
  browserVoiceProbe = await probe.evaluate(async () => ({ speechApiExposed: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition), mediaCaptureExposed: Boolean(navigator.mediaDevices?.getUserMedia), microphonePermission: await navigator.permissions.query({name:'microphone'}).then(p=>p.state).catch(()=> 'unknown'), realCapture: 'NOT_RUN: headless automation; no interactive microphone approval or audio fixture for real speech service' }));
  await probe.close();
  for (const width of [390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
    const errors = [], failedRequests = [], deniedOrigins = [], requests = [];
    let reply = { reply: "Synthetic test response.", persistence_saved: true, execution: { status: "read_only" } };
    let releaseResponse;
    let hold = false;
    // Consumer's existing root presence bridge is outside the shared package.
    // Keep its transport entirely in-process too; this is not realtime validation.
    await context.routeWebSocket("**/*", (socket) => {
      const url = new URL(socket.url());
      if (url.hostname !== "localhost" || url.port !== "5000") { deniedOrigins.push(url.origin); socket.close(); return; }
      socket.send('0{"sid":"presentation-only","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
      socket.onMessage((message) => {
        if (message === "40") socket.send('40{"sid":"presentation-only"}');
        if (message === "2") socket.send("3");
      });
    });
    await context.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin === origin) { await route.continue(); return; }
      if (url.origin !== "http://localhost:5000") { deniedOrigins.push(url.origin); await route.abort(); return; }
      if (req.method() === "OPTIONS") { await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" } }); return; }
      const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" };
      if (url.pathname === "/oyi/runtime/conversation") {
        requests.push(req.postDataJSON());
        if (hold) await new Promise((resolve) => { releaseResponse = resolve; });
        await route.fulfill({ headers, json: { ok: true, response: reply } });
      } else if (url.pathname === "/oyi/threads/synthetic-history/messages") {
        await route.fulfill({ headers, json: { ok: true, thread: { id: "synthetic-history", title: "Synthetic restored action", message_count: 2 }, messages: [
          { id: "old-user", role: "user", content: "Test action", created_at: "2026-10-01T10:00:00Z" },
          { id: "old-reply", role: "assistant", content: "The command was accepted, but the final state could not be verified.", created_at: "2026-10-01T10:00:01Z", metadata: { ...example("E"), display_mode: "detail", presentation_policy: { primary: "execution" } } },
        ] } });
      } else await route.fulfill({ headers, json: { ok: true, data: [], threads: [] } });
    });
    // A browser event fixture, not a microphone/provider integration test.
    await context.addInitScript(() => {
      window.SpeechRecognition = class {
        constructor() { window.__speechFixture = this; }
        start() { if (window.__fixtureDenied) this.onerror?.({ error: "not-allowed" }); else this.onstart?.(); }
        stop() { /* final results and end are emitted explicitly by the fixture */ }
        abort() { window.__speechAbortCount = (window.__speechAbortCount || 0) + 1; }
      };
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        cancel() { window.__speechOutput = null; },
        speak(utterance) { window.__speechOutput = utterance; },
      } });
      window.__fixtureSpeech = (text, final = false) => {
        const result = [{ transcript: text }]; result.isFinal = final;
        window.__speechFixture?.onresult?.({ results: [result] });
      };
      window.__fixtureSegments = (segments) => window.__speechFixture?.onresult?.({ results: segments.map(([text, final]) => { const r = [{ transcript: text }]; r.isFinal = final; return r; }) });
      // Deterministic measured-level API fixture, not real microphone audio.
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
      window.AudioContext = class {
        createAnalyser() { return { fftSize: 256, frequencyBinCount: 128, getByteTimeDomainData(a) { for(let i=0;i<a.length;i++) a[i]=128+(i%7)*5; } }; }
        createMediaStreamSource() { return { connect() {} }; }
        async close() {}
      };
      localStorage.setItem("oyi_ai_conversations_v1", JSON.stringify([{ id: "backend:synthetic-history", backendThreadId: "synthetic-history", title: "Synthetic restored action", updatedAt: 1790848800000, messageCount: 2, messages: [] }]));
    });
    const page = await context.newPage(); activePage = page;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("requestfailed", (req) => failedRequests.push({ path: new URL(req.url()).pathname, error: req.failure()?.errorText }));
    await page.goto(`${origin}/ai`);
    await page.getByRole("textbox", { name: "Message Oyi" }).waitFor();
    await page.waitForFunction(() => document.querySelector('.oyi-shell')?.getAttribute('data-layout') === (innerWidth >= 1024 ? 'desktop' : innerWidth >= 768 ? 'tablet' : 'mobile'));
    const shot = (name) => page.screenshot({ path: path.join(output, `${width}-${name}.png`) });
    async function noOverflow() {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "horizontal overflow");
      const box = await page.locator(".oyi-composer").boundingBox();
      assert.ok(box && box.height > 0 && box.y >= 0 && box.x >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= (await page.viewportSize()).height + 1, "composer clipped");
    }
    await check(`${width}: idle, minimal controls, responsive shell, reduced motion`, async () => {
      await noOverflow();
      assert.equal(await page.getByRole("button", { name: "Speak to Oyi" }).count(), 1);
      assert.ok(await page.getByRole("button", { name: "Start Live Voice", exact: true }).isVisible());
      assert.equal(await page.getByRole("button", { name: "Send message", exact: true }).count(), 0);
      assert.ok(await page.getByRole("button", { name: "Attachments unavailable" }).isDisabled());
      assert.equal(await page.locator('input[type="file"]').count(), 0, "no invented upload contract");
      assert.equal(await page.locator(".oyi-orb[data-size=large]").count(), 1);
      const body = await page.locator("body").innerText();
      assert.doesNotMatch(body, /Living intelligence|How can I help\?|Thinking|Working on your request/);
      assert.equal(await page.locator(".oyi-orb-core").first().evaluate((el) => getComputedStyle(el).animationName), "none");
      const logo = page.locator('.oyi-shell-rail-start .oyi-orb[data-size="identity"]');
      assert.equal(await logo.getAttribute('aria-label'), 'Oyi');
      assert.equal(await page.locator('.oyi-shell-rail-start .oyi-reference-identity').innerText(), 'Oyi', 'no external wordmark');
      assert.equal(await page.locator('.oyi-reference-identity > span:not(.oyi-orb)').count(), 0);
      const bounds = await logo.boundingBox();
      const lettering = await logo.locator('.oyi-orb-wordmark').boundingBox();
      assert.ok(Math.abs(bounds.width-44)<0.1 && Math.abs(bounds.height-44)<0.1, '44px circular identity (subpixel tolerance)');
      assert.ok(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=width, 'logo clipped');
      assert.ok(Math.abs(lettering.x+lettering.width/2-bounds.x-22)<1 && Math.abs(lettering.y+lettering.height/2-bounds.y-22)<1, 'wordmark not centered');
      assert.ok(lettering.width<44 && lettering.height<44);
      const hamburger = await page.locator('.oyi-shell-rail-start > button').boundingBox();
      assert.ok(Math.abs(hamburger.y+hamburger.height/2-bounds.y-22)<1, 'top controls misaligned');
      const styles = await page.evaluate(() => {
        const logo=document.querySelector('.oyi-shell-rail-start .oyi-orb'), hero=document.querySelector('.oyi-orb[data-size="large"]');
        return [logo,hero].map(el=>({background:getComputedStyle(el).backgroundImage,core:getComputedStyle(el.querySelector('.oyi-orb-core')).backgroundImage,color:getComputedStyle(el.querySelector('.oyi-orb-wordmark')).color}));
      });
      assert.deepEqual(styles[0],styles[1], 'identity must share hero gradient and lettering color');
      const hero=await page.locator('.oyi-orb[data-size="large"]').boundingBox();
      assert.ok(Math.abs(hero.width-(width>=1024?176:136))<0.1,'hero size unchanged');
      if (width >= 1024) {
        assert.ok(await page.getByRole("navigation", { name: "Consumer modules" }).isVisible());
        const sidebar = await page.locator(".oyi-shell-sidebar").boundingBox();
        const canvas = await page.locator(".oyi-shell-column").boundingBox();
        assert.ok(Math.abs(canvas.x - (sidebar.x + sidebar.width)) < 2);
      }
      await shot("idle");
    });
    if (width < 1024) await check(`${width}: navigation drawer traps focus and returns it on Escape`, async () => {
      const trigger = page.getByRole("button", { name: "Open navigation" });
      await trigger.click();
      await page.getByRole("dialog", { name: "Navigation", exact: true }).waitFor();
      await page.keyboard.press("Shift+Tab");
      assert.ok(await page.evaluate(() => !!document.activeElement.closest(".oyi-shell-sidebar")));
      await shot("navigation"); await page.keyboard.press("Escape");
      assert.ok(await trigger.evaluate((el) => document.activeElement === el));
    });
    await check(`${width}: shared history restores action truth through the existing HTTP contract`, async () => {
      if (width < 1024) await page.getByRole("button", { name: "Conversation history", exact: true }).click();
      await shot("history");
      await page.getByRole("button", { name: /Synthetic restored action/ }).filter({ visible: true }).click();
      await page.locator(".oyi-caption-line").filter({ hasText: "The command was accepted, but the final state could not be verified." }).waitFor();
      assert.ok(await page.locator('[data-action-verified="false"]').count());
      assert.equal(await page.locator('[data-action-verified="true"]').count(), 0);
      await shot("restored-unobservable");
      await page.getByRole("button", { name: "New conversation", exact: true }).filter({ visible: true }).first().click();
    });
    await check(`${width}: voice fixture, interim transcript, cancellation`, async () => {
      await page.getByRole("textbox", { name: "Message Oyi" }).fill("Preserved draft");
      await page.getByRole("button", { name: "Speak to Oyi" }).click();
      await page.getByRole("button", { name: "Stop voice input" }).waitFor();
      await page.evaluate(() => window.__fixtureSpeech("Synthetic voice draft"));
      await page.waitForFunction(() => document.querySelector('.oyi-composer-timer')?.textContent !== '0:00');
      assert.equal(await page.locator('.oyi-composer-voice-label').count(), 0);
      assert.ok(await page.getByRole('meter', { name: 'Microphone input level' }).isVisible());
      assert.ok(await page.getByRole('button', { name: 'Finalize and send voice message' }).isVisible());
      assert.equal(await page.locator('.oyi-composer-voice-dot').evaluate(el => getComputedStyle(el).animationName), 'none');
      if (width === 390) {
        await page.emulateMedia({reducedMotion:'no-preference'});
        assert.equal(await page.locator('.oyi-composer-voice-dot').evaluate(el => getComputedStyle(el).animationName), 'oyi-recording-blink');
        await page.emulateMedia({reducedMotion:'reduce'});
      }
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await noOverflow();
      await shot("listening");
      await page.setViewportSize({width,height:450});
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--vvh') === '450px');
      await noOverflow(); await shot('listening-short-viewport');
      await page.setViewportSize({width,height:900});
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--vvh') === '900px');
      await page.getByRole("button", { name: "Cancel voice input" }).click();
      assert.equal(await page.getByRole("textbox", { name: "Message Oyi" }).inputValue(), "Preserved draft");
      assert.equal(requests.length, 0);
      await shot("cancel-preserved-draft");
    });
    await check(`${width}: Stop finalizes without sending and appends to existing editable text`, async () => {
      await page.getByRole("button", { name: "Speak to Oyi" }).click();
      const cancel = await page.getByRole("button", { name: "Cancel voice input" }).boundingBox();
      const stop = await page.getByRole("button", { name: "Stop voice input" }).boundingBox();
      assert.ok(cancel.x < stop.x, "cancel must lead recording controls");
      await page.evaluate(() => window.__fixtureSpeech("unfinished", false));
      await page.evaluate(() => {
        document.querySelector('[aria-label="Stop voice input"]').click();
        document.querySelector('[aria-label="Finalize and send voice message"]')?.click();
      });
      assert.ok(await page.getByRole("button", { name: "Stop voice input" }).isDisabled());
      assert.ok(await page.getByRole("button", { name: "Finalize and send voice message" }).isDisabled());
      await page.getByRole("button", { name: "Finalize and send voice message" }).evaluate(el => el.click());
      await noOverflow(); await shot("finalizing");
      await page.evaluate(() => { window.__fixtureSpeech("Final transcript", true); window.__speechFixture.onend(); });
      const input = page.getByRole("textbox", { name: "Message Oyi" });
      await input.waitFor();
      assert.equal(await input.inputValue(), "Preserved draft Final transcript");
      assert.equal(requests.length, 0, "Stop must not submit");
      await input.fill("Edited transcription");
      assert.ok(await page.getByRole("button", { name: "Speak to Oyi" }).isVisible());
      assert.ok(await page.getByRole("button", { name: "Send message", exact: true }).isEnabled());
      await shot("transcribed-editable");
    });
    await check(`${width}: permission rejection is honest and preserves typed text`, async () => {
      await page.evaluate(() => { window.__fixtureDenied = true; });
      await page.getByRole("button", { name: "Speak to Oyi" }).click();
      await page.getByText("Microphone or speech permission was denied. Allow access in browser settings or type your message.", { exact: true }).waitFor();
      assert.equal(await page.getByRole("textbox", { name: "Message Oyi" }).inputValue(), "Edited transcription");
      assert.equal(requests.length, 0);
      await shot("permission-denied");
      await page.evaluate(() => { window.__fixtureDenied = false; });
    });
    await check(`${width}: voice Send waits for all final segments and submits exactly once`, async () => {
      const before = requests.length;
      await page.getByRole('textbox', { name: 'Message Oyi' }).fill('Existing draft');
      await page.getByRole('button', { name: 'Speak to Oyi' }).click();
      await page.evaluate(() => window.__fixtureSegments([['first segment', true], ['pending tail', false]]));
      hold = true;
      await page.evaluate(() => {
        const send=document.querySelector('[aria-label="Finalize and send voice message"]');
        send.click();send.click();
        document.querySelector('[aria-label="Stop voice input"]')?.click();
      });
      await page.getByRole('button', { name: 'Stop voice input' }).evaluate(el => el.click());
      assert.equal(requests.length, before);
      await shot('voice-send-finalizing');
      await page.evaluate(() => {
        const speech=window.__speechFixture, late=speech.onend;
        window.__fixtureSegments([['first segment', true], ['second segment', true]]);
        speech.onend(); late();
      });
      await page.getByText('Working on your request…', { exact: true }).filter({visible:true}).first().waitFor();
      assert.equal(requests.length, before+1);
      assert.equal(requests.at(-1).message, 'Existing draft first segment second segment');
      await shot('voice-send-working');
      hold=false;releaseResponse();
      await page.locator('.oyi-reference-message[data-role="assistant"]').filter({hasText:'Synthetic test response.'}).waitFor();
      assert.equal(requests.length, before+1);
    });
    await check(`${width}: voice failures never send blank or partial text; draft remains recoverable`, async () => {
      const before=requests.length;
      for (const failure of ['empty','partial','network','timeout']) {
        const input=page.getByRole('textbox',{name:'Message Oyi'});
        await input.fill('Saved draft');
        await page.getByRole('button',{name:'Speak to Oyi'}).click();
        if (failure==='partial') await page.evaluate(() => window.__fixtureSegments([['final prefix',true],['unfinished tail',false]]));
        if (failure==='network' || failure==='timeout') await page.evaluate(() => window.__fixtureSpeech('recoverable words',false));
        await page.getByRole('button',{name:'Finalize and send voice message'}).click();
        if(failure==='network') await page.evaluate(() => window.__speechFixture.onerror({error:'network'}));
        else if(failure!=='timeout') await page.evaluate(() => window.__speechFixture.onend());
        else await page.evaluate(() => { window.__lateResult=window.__speechFixture.onresult;window.__lateEnd=window.__speechFixture.onend; });
        await input.waitFor({timeout:8000});
        assert.ok((await input.inputValue()).startsWith('Saved draft'));
        if(failure==='partial') assert.equal(await input.inputValue(),'Saved draft final prefix unfinished tail');
        if(failure==='network' || failure==='timeout') assert.equal(await input.inputValue(),'Saved draft recoverable words');
        if(failure==='timeout') await page.evaluate(() => { const r=[{transcript:'too late'}];r.isFinal=true;window.__lateResult({results:[r]});window.__lateEnd(); });
        assert.equal(requests.length,before);
      }
      await shot('voice-error-recoverable');
    });
    await check(`${width}: cancel during finalization invalidates pending auto-send`, async () => {
      const before=requests.length;
      const input=page.getByRole('textbox',{name:'Message Oyi'});await input.fill('Keep only this');
      await page.getByRole('button',{name:'Speak to Oyi'}).click();
      await page.evaluate(() => { window.__fixtureSpeech('discarded words',true);window.__lateEnd=window.__speechFixture.onend; });
      await page.getByRole('button',{name:'Finalize and send voice message'}).click();
      await page.getByRole('button',{name:'Cancel voice input'}).click();
      await page.evaluate(() => window.__lateEnd());
      assert.equal(await input.inputValue(),'Keep only this');assert.equal(requests.length,before);
    });
    await check(`${width}: typing, real request-in-flight, duplicate-send guard, long response`, async () => {
      const before=requests.length;
      const input = page.getByRole("textbox", { name: "Message Oyi" });
      await input.fill("A synthetic long-response request");
      assert.equal(await page.getByRole("button", { name: "Speak to Oyi" }).count(), 1);
      await shot("typing");
      reply = { reply: "Synthetic response paragraph. ".repeat(70), persistence_saved: true, execution: { status: "read_only" } };
      hold = true;
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      await page.getByText("Working on your request…", { exact: true }).filter({ visible: true }).first().waitFor();
      await input.fill("Draft while pending"); await input.press("Enter");
      assert.equal(requests.length, before + 1);
      await shot("working");
      hold = false; releaseResponse();
      await page.getByRole("button", { name: "Show more" }).waitFor();
      await page.getByRole("button", { name: "Show more" }).click();
      await noOverflow(); await shot("long-response");
    });
    await check(`${width}: wide table stays inside the response with its own scroll boundary`, async () => {
      reply = { reply: "Synthetic table response.", display_mode: "report", cards: [{ type: "table", title: "Synthetic records", columns: [{ key: "name", label: "Record" }, { key: "description", label: "Description" }, { key: "status", label: "Status" }], rows: [{ name: "Synthetic example", description: "A deliberately wide synthetic description to exercise the internal table scrolling boundary.", status: "Unobservable" }] }], persistence_saved: true, execution: { status: "read_only" } };
      const input = page.getByRole("textbox", { name: "Message Oyi" });
      await input.fill("Show the synthetic table"); await input.press("Enter");
      await page.getByRole("table").waitFor();
      const boundary = await page.getByRole("table").locator("..").boundingBox();
      assert.ok(boundary && boundary.x >= 0 && boundary.x + boundary.width <= width + 1, "table scroll boundary clipped");
      await noOverflow(); await shot("table-response");
    });
    await check(`${width}: confirmation remains separate; unobservable and not-saved are honest`, async () => {
      const input = page.getByRole("textbox", { name: "Message Oyi" });
      reply = { ...example("A"), reply: "Review this synthetic action.", display_mode: "detail", confirmations: [{ workflow_id: "synthetic-workflow", action_id: "action-A", status: "awaiting_confirmation", proposal: "Turn on Hall Light", target: { label: "Hall Light" } }], persistence_saved: true };
      await input.fill("Propose the synthetic action"); await input.press("Enter");
      await page.getByRole("button", { name: "Confirm", exact: true }).waitFor();
      assert.ok(await page.getByText("Nothing has been sent yet.").count());
      await shot("confirmation");
      reply = { ...example("E"), reply: "The provider accepted the synthetic command. Oyi could not verify the final state.", display_mode: "detail", persistence_saved: false };
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page.getByText("This response could not be saved to History.", { exact: true }).waitFor();
      assert.equal(requests.at(-1).message, "Confirm");
      assert.equal(requests.at(-1).workflow_id, "synthetic-workflow");
      assert.equal(await page.locator('[data-action-verified="true"]').count(), 0);
      await noOverflow(); await shot("unobservable-not-saved");
    });
    await check(`${width}: live hub is above unchanged composer, actual speech events and thread synchronization`, async () => {
      await page.getByRole('button',{name:'New conversation',exact:true}).filter({visible:true}).first().click();
      const input=page.getByRole('textbox',{name:'Message Oyi'});
      const before=requests.length;
      const geometry=await page.locator('.oyi-composer').boundingBox();
      await page.getByRole('button',{name:'Start Live Voice',exact:true}).click();
      await page.locator('.oyi-live-voice-hub[data-phase="listening"]').waitFor();
      assert.equal(await page.locator('.oyi-live-voice-caption').innerText(),'Listening…');
      const style=await page.locator('.oyi-live-voice-hub').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundImage,color:s.backgroundColor,border:s.borderTopWidth,shadow:s.boxShadow,padding:s.padding};});
      assert.deepEqual(style,{background:'none',color:'rgba(0, 0, 0, 0)',border:'0px',shadow:'none',padding:'0px'});
      assert.equal(await page.locator('.oyi-live-voice-hub button').count(),0,'no duplicated hub controls');
      assert.equal(await page.locator('.oyi-live-voice-hub .oyi-voice-level').count(),0);
      const hub=await page.locator('.oyi-live-voice-hub').boundingBox(), composer=await page.locator('.oyi-composer').boundingBox();
      assert.ok(hub.y+hub.height<=composer.y && composer.y-hub.y-hub.height<=20,'hub immediately above composer');
      assert.ok(hub.height<=90 && hub.width<=420.1,'no panel-sized empty gap');assert.deepEqual(composer,geometry,'composer unchanged');
      const orb=await page.locator('.oyi-live-voice-orb .oyi-orb').boundingBox();assert.ok(Math.abs(orb.x+orb.width/2-composer.x-composer.width/2)<1,'orb centered over composer');
      assert.equal(await page.getByRole('button',{name:'End Live Voice',exact:true}).count(),1);
      assert.equal(await page.locator('.oyi-composer [aria-label="End Live Voice"]').count(),1);
      assert.ok(await page.getByRole('button',{name:'One-shot microphone unavailable while Live Voice is active',exact:true}).isDisabled());
      await shot('live-empty');await input.fill('Keep this typed draft');await noOverflow();assert.ok(await page.getByRole('button',{name:'Send message',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'End Live Voice',exact:true}).isVisible());await shot('live-listening');
      reply={reply:'Actual synthetic live response.',thread_id:'synthetic-live',persistence_saved:true,execution:{status:'read_only'}};hold=true;
      await page.evaluate(()=>{window.__fixtureSegments([['First',true],['live utterance',true]]);window.__lateLiveEnd=window.__speechFixture.onend;window.__speechFixture.onend();window.__lateLiveEnd();});
      await page.locator('.oyi-live-voice-hub[data-phase="working"]').waitFor();
      assert.equal(requests.length,before+1);assert.equal(requests.at(-1).message,'First live utterance');
      assert.equal(await page.locator('.oyi-orb[data-size="large"]').count(),0,'hero disappears after message');await shot('live-working');
      hold=false;releaseResponse();
      await page.waitForFunction(()=>Boolean(window.__speechOutput));
      assert.equal(await page.evaluate(()=>window.__speechOutput.text),'Actual synthetic live response.');
      assert.equal(await input.inputValue(),'Keep this typed draft');
      await page.evaluate(()=>window.__speechOutput.onstart());await page.locator('.oyi-live-voice-hub[data-phase="speaking"]').waitFor();assert.equal(await page.locator('.oyi-live-voice-caption').innerText(),'Speaking…');await shot('live-speaking');
      await page.evaluate(()=>window.__speechOutput.onend());await page.locator('.oyi-live-voice-hub[data-phase="listening"]').waitFor();
      reply={...example('A'),reply:'Review this synthetic voice action.',thread_id:'synthetic-live',display_mode:'detail',confirmations:[{workflow_id:'live-workflow',action_id:'live-action',status:'awaiting_confirmation',proposal:'Test action',target:{label:'Fixture only'}}],persistence_saved:true};
      await page.evaluate(()=>{window.__fixtureSpeech('Propose an isolated action',true);window.__speechFixture.onend();});
      await page.getByRole('button',{name:'Confirm',exact:true}).waitFor();
      assert.equal(requests.at(-1).thread_id,'synthetic-live');assert.ok(await page.getByText('Nothing has been sent yet.').count());
      await page.waitForFunction(()=>Boolean(window.__speechOutput));await page.evaluate(()=>{window.__speechOutput.onstart();window.__speechOutput.onend();});
      await page.locator('.oyi-live-voice-hub[data-phase="listening"]').waitFor();
      assert.equal(requests.length,before+2,'no automatic action confirmation');await shot('live-confirmation');
    });
    await check(`${width}: live mute, late input, keyboard, end and permission recovery`, async()=>{
      const before=requests.length;
      await page.evaluate(()=>{window.__lateLiveResult=window.__speechFixture.onresult;window.__lateLiveEnd=window.__speechFixture.onend;});
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      await page.locator('.oyi-live-voice-hub[data-phase="muted"]').waitFor();
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.locator('.oyi-live-voice-hub').getAttribute('data-phase'),'muted','visibility return must not restart capture');
      await page.evaluate(()=>{const row=[{transcript:'must not submit'}];row.isFinal=true;window.__lateLiveResult({results:[row]});window.__lateLiveEnd();});
      assert.equal(requests.length,before);await page.locator('.oyi-live-voice-hub[data-phase="muted"]').waitFor();
      await page.setViewportSize({width,height:450});await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--vvh')==='450px');
      await noOverflow();const hub=await page.locator('.oyi-live-voice-hub').boundingBox(),box=await page.locator('.oyi-composer').boundingBox();assert.ok(hub.y+hub.height<=box.y && hub.y>60);await shot('live-keyboard-muted');
      await page.setViewportSize({width,height:900});await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--vvh')==='900px');
      await page.locator('.oyi-live-voice-details summary').click();await page.getByRole('button',{name:'Resume voice',exact:true}).click();await page.locator('.oyi-live-voice-hub[data-phase="listening"]').waitFor();
      const aborted=await page.evaluate(()=>window.__speechAbortCount||0);
      await page.getByRole('button',{name:'End Live Voice',exact:true}).click();assert.equal(await page.locator('.oyi-live-voice-hub').count(),0);assert.equal(await page.getByRole('textbox',{name:'Message Oyi'}).inputValue(),'Keep this typed draft');assert.ok(await page.evaluate(n=>window.__speechAbortCount>n,aborted),'End aborts microphone');
      await page.getByRole('textbox',{name:'Message Oyi'}).fill('');await page.evaluate(()=>{window.__fixtureDenied=true;});await page.getByRole('button',{name:'Start Live Voice',exact:true}).click();await page.locator('.oyi-live-voice-hub[data-phase="error"]').waitFor();await shot('live-permission-error');assert.equal(requests.length,before);
      assert.equal(await page.locator('.oyi-live-voice-caption').innerText(),'Voice interrupted');assert.ok(!(await page.locator('.oyi-live-voice-details p').isVisible()));await page.locator('.oyi-live-voice-details summary').click();assert.match(await page.locator('.oyi-live-voice-details p').innerText(),/permission was denied/);await shot('live-error-details');
      await page.evaluate(()=>{window.__fixtureDenied=false;});await page.getByRole('button',{name:'Resume voice',exact:true}).click();await page.locator('.oyi-live-voice-hub[data-phase="listening"]').waitFor();
    });
    await check(`${width}: offline and short visual viewport keep composer accessible`, async () => {
      await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }); window.dispatchEvent(new Event("offline")); });
      await page.getByText("You’re offline. Reconnect to send a message.", { exact: true }).waitFor();
      await page.locator('.oyi-live-voice-hub[data-phase="muted"]').waitFor();
      assert.ok(await page.getByRole("textbox", { name: "Message Oyi" }).isDisabled());
      await shot("offline");
      await page.setViewportSize({ width, height: 450 });
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--vvh") === "450px");
      await noOverflow(); await shot("short-viewport");
      assert.ok(await page.getByRole('button',{name:'End Live Voice',exact:true}).isEnabled());await page.getByRole('button',{name:'End Live Voice',exact:true}).focus();await page.keyboard.press('Escape');assert.equal(await page.locator('.oyi-live-voice-hub').count(),0,'offline session can still end');
    });
    await check(`${width}: no hydration/console errors, unexpected requests or external access`, async () => {
      assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []); assert.deepEqual(deniedOrigins, []);
    });
    await context.close(); activePage = null;
  }
} catch {
  if (activePage) await activePage.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close(); await new Promise((resolve) => server.close(resolve));
  const report = { mode: "isolated presentation fixtures; no authenticated identity or real execution", authenticated_backend: "BLOCKED: no approved test identity/configuration available", browserVoiceProbe, results, screenshots: output };
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, pass: results.filter((r) => r.status === "PASS").length, fail: results.filter((r) => r.status === "FAIL").length }));
}
