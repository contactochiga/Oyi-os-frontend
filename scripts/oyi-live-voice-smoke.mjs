import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { createTsLoader } from './oyi-ts-loader.mjs';
const load=createTsLoader(process.cwd(),path.join(process.cwd(),'src'));
const {createConsumerSpeechOutput}=load('src/oyi/consumerSpeechOutput.ts');
const {createConsumerVoiceAdapter}=load('src/oyi/consumerVoiceAdapter.ts');
function fixture(){
  let utterance,cancels=0;
  const host={SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},speechSynthesis:{cancel(){cancels++;},speak(u){utterance=u;}}};
  return {host,output:createConsumerSpeechOutput(host),utterance:()=>utterance,cancels:()=>cancels};
}
test('output is pending until actual start and end',async()=>{
  const f=fixture();let started=false,done=false;const p=f.output.speak('Actual canonical response',()=>{started=true;}).then(()=>{done=true;});
  assert.equal(started,false);assert.equal(f.utterance().text,'Actual canonical response');f.utterance().onstart();assert.equal(started,true);assert.equal(done,false);f.utterance().onend();await p;assert.equal(done,true);
});
test('output error and cancellation cannot report successful speech',async()=>{
  for(const mode of ['error','cancel','end-before-start']){const f=fixture();const p=f.output.speak('Response',()=>{});const rejection=assert.rejects(p);const late=f.utterance().onstart;
    if(mode==='error')f.utterance().onerror();else if(mode==='cancel')f.output.cancel();else f.utterance().onend();
    late();await rejection;assert.ok(f.cancels()>=2);
  }
});
test('new playback cancels old output; only one audio stream',async()=>{
  const f=fixture();const old=f.output.speak('first',()=>{});const rejected=assert.rejects(old);const next=f.output.speak('second',()=>{});await rejected;f.utterance().onstart();f.utterance().onend();await next;
});
test('unsupported and native playback are explicit',async()=>{
  for(const host of [{},{...fixture().host,Capacitor:{isNativePlatform:()=>true}}]){const output=createConsumerSpeechOutput(host);assert.equal(output.available,false);await assert.rejects(output.speak('hello',()=>{}));}
});
test('speech start and playback deadlines fail honestly',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const f=fixture();const p=f.output.speak('reply',()=>{});const rejected=assert.rejects(p,/did not start/);t.mock.timers.tick(10001);await rejected;
  const q=f.output.speak('reply',()=>{});const timeout=assert.rejects(q,/timed out/);f.utterance().onstart();t.mock.timers.tick(120001);await timeout;
});
test('live utterance mode is opt-in; all final segments wait for end; no partial delivery',()=>{
  let current;
  const setCurrent = instance => { current = instance; };
  class Recognition {constructor(){setCurrent(this);}start(){this.onstart();}stop(){this.stopped=true;}abort(){}}
  const adapter=createConsumerVoiceAdapter({SpeechRecognition:Recognition},{singleUtterance:true});adapter.startListening();assert.equal(current.continuous,false);
  const result=text=>{const row=[{transcript:text}];row.isFinal=true;return row;};
  current.onresult({results:[result('first'),result('second')]});assert.equal(current.stopped,true);assert.equal(adapter.getSnapshot().status,'transcribing');current.onend();assert.equal(adapter.getSnapshot().finalTranscript,'first second');
  const standard=createConsumerVoiceAdapter({SpeechRecognition:Recognition});standard.startListening();assert.equal(current.continuous,true);standard.cancelListening();
});
