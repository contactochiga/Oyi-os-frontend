import assert from "node:assert/strict";
import path from "node:path";
import { createTsLoader } from "./oyi-ts-loader.mjs";
const { createConsumerVoiceAdapter } = createTsLoader(process.cwd(), path.join(process.cwd(), "src"))("src/oyi/consumerVoiceAdapter.ts");
let latest;
const setLatest = (instance) => { latest = instance; };
class Recognition {
  constructor() { setLatest(this); }
  start() { this.onstart?.(); }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
}
const results = (text, final = true) => { const row = [{ transcript: text }]; row.isFinal = final; return { results: [row] }; };
let count = 0;
function check(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
const adapter = createConsumerVoiceAdapter({ SpeechRecognition: Recognition });
check("start follows actual onstart; final results wait for end", () => {
  adapter.startListening(); assert.equal(adapter.getSnapshot().status, "listening");
  latest.onresult(results("draft", false)); assert.equal(adapter.getSnapshot().finalTranscript, "");
  adapter.stopListening(); assert.equal(latest.stopped, true); assert.equal(adapter.getSnapshot().status, "transcribing");
  latest.onresult(results("final words")); latest.onend();
  assert.equal(adapter.getSnapshot().finalTranscript, "final words"); assert.equal(adapter.getSnapshot().status, "idle");
});
check("cancel discards transcript and ignores captured late callbacks", () => {
  adapter.startListening(); const old = latest; const late = old.onresult; const end = old.onend;
  old.onresult(results("discard me")); adapter.cancelListening(); late(results("late words")); end();
  assert.equal(old.aborted, true); assert.equal(adapter.getSnapshot().finalTranscript, "");
});
check("cancel before microphone grant is terminal", () => {
  class Waiting extends Recognition { start() {} }
  const pending = createConsumerVoiceAdapter({ SpeechRecognition: Waiting }); pending.startListening(); const late = latest.onstart;
  pending.cancelListening(); late(); assert.equal(pending.getSnapshot().status, "idle"); assert.notEqual(pending.getSnapshot().permissionState, "prompt");
});
check("permission denial and late end never become success", () => {
  adapter.startListening(); const end = latest.onend; latest.onerror({ error: "not-allowed" }); end();
  assert.equal(adapter.getSnapshot().permissionState, "denied"); assert.equal(adapter.getSnapshot().status, "error");
});
check("network failure is explicit", () => { adapter.startListening(); latest.onerror({ error: "network" }); assert.match(adapter.getSnapshot().error, /service is unavailable/); });
check("interim-only ending is not fabricated final text", () => { adapter.startListening(); latest.onresult(results("unfinished", false)); latest.onend(); assert.equal(adapter.getSnapshot().status, "error"); assert.equal(adapter.getSnapshot().finalTranscript, ""); });
check("natural end retains real final text", () => { adapter.startListening(); latest.onresult(results("natural final")); latest.onend(); assert.equal(adapter.getSnapshot().finalTranscript, "natural final"); });
check("cumulative final segments retain order without duplication", () => {
  adapter.startListening(); latest.onresult(results("first"));
  const rows = ["first", "second", "third"].map(text => { const r=[{transcript:text}];r.isFinal=true;return r; });
  latest.onresult({results:rows}); latest.onresult({results:rows}); adapter.stopListening(); latest.onend();
  assert.equal(adapter.getSnapshot().finalTranscript,"first second third");
});
check("final prefix plus unfinished tail is error, never partial success", () => {
  adapter.startListening(); const a=results("finished").results[0],b=results("unfinished",false).results[0];
  latest.onresult({results:[a,b]});adapter.stopListening();latest.onend();
  assert.equal(adapter.getSnapshot().status,"error");assert.equal(adapter.getSnapshot().finalTranscript,"finished");assert.equal(adapter.getSnapshot().interimTranscript,"unfinished");
});
check("empty end fails; repeated Stop cannot restart finalization", () => {
  adapter.startListening();let stops=0;latest.stop=()=>stops++;adapter.stopListening();adapter.stopListening();assert.equal(stops,1);latest.onend();assert.equal(adapter.getSnapshot().status,"error");
});
check("error preserves available words without promoting them to success", () => {
  adapter.startListening();latest.onresult(results("recover these",false));const end=latest.onend;latest.onerror({error:"network"});end();assert.equal(adapter.getSnapshot().status,"error");assert.equal(adapter.getSnapshot().interimTranscript,"recover these");
});
check("unsupported browser and native are honest", () => { for (const host of [{}, { SpeechRecognition: Recognition, Capacitor: { isNativePlatform: () => true } }]) { const a = createConsumerVoiceAdapter(host); a.startListening(); assert.equal(a.kind, "unavailable"); assert.equal(a.getSnapshot().status, "error"); } });
check("constructor/start failure is explicit", () => { class Broken { start() { throw Error("fixture"); } abort() {} } const a=createConsumerVoiceAdapter({SpeechRecognition:Broken});a.startListening();assert.equal(a.getSnapshot().status,"error"); });
check("constructor failure cannot recover an older session transcript", () => {
  let broken=false;class SometimesBroken extends Recognition { constructor(){super();if(broken)throw Error('fixture');} }
  const a=createConsumerVoiceAdapter({SpeechRecognition:SometimesBroken});a.startListening();latest.onresult(results('old completed transcript'));latest.onend();broken=true;a.startListening();
  assert.equal(a.getSnapshot().status,'error');assert.equal(a.getSnapshot().finalTranscript,'');assert.equal(a.getSnapshot().interimTranscript,'');
});
check("unsubscribe prevents notifications", () => { let n=0;const off=adapter.subscribe(()=>n++);off();adapter.startListening();adapter.cancelListening();assert.equal(n,0); });
check("unmount cleanup invalidates pending finalization and late callbacks", () => {
  const a=createConsumerVoiceAdapter({SpeechRecognition:Recognition});let deliveries=0;const unsubscribe=a.subscribe(()=>deliveries++);
  a.startListening();a.stopListening();const current=latest,late=current.onresult,end=current.onend;const before=deliveries;
  unsubscribe();a.cancelListening();late(results("late after unmount"));end();
  assert.equal(deliveries,before);assert.equal(current.aborted,true);assert.equal(a.getSnapshot().finalTranscript,"");
});
adapter.startListening();
const lateFinal = latest.onresult;
adapter.stopListening();
await new Promise(resolve => setTimeout(resolve, 5100));
check("stop deadline fails honestly; late result cannot restore success", () => {
  assert.equal(adapter.getSnapshot().status, "error");
  lateFinal(results("too late"));
  assert.equal(adapter.getSnapshot().finalTranscript, "");
});
console.log(`${count} voice contract checks passed`);
