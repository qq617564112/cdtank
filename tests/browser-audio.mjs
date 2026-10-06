import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const origin = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!endpoint) throw new Error('Usage: node tests/browser-audio.mjs <Chromium CDP WebSocket URL> [origin]');
const ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
let sequence = 0;
const pending = new Map();
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(session, expression) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
const pages = [];
try {
  const {targetId} = await command('Target.createTarget', {url: origin, newWindow: true});
  pages.push(targetId);
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  // Real input grants browser media activation; no autoplay policy bypass.
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', x: 600, y: 100, button: 'left', clickCount: 1}, sessionId);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 600, y: 100, button: 'left', clickCount: 1}, sessionId);
  const evidence = await evaluate(sessionId, `(async()=>{
    const catalog=await(await fetch('/audio.json')).json();
    const mediaReady=audio=>new Promise((resolve,reject)=>{
      if(audio.readyState>=2){resolve();return;}
      const timer=setTimeout(()=>{cleanup();reject(new Error('Audio decode timeout '+audio.src));},15000);
      const cleanup=()=>{clearTimeout(timer);audio.removeEventListener('loadeddata',ready);audio.removeEventListener('error',error);};
      const ready=()=>{cleanup();resolve();},error=()=>{cleanup();reject(new Error('Audio error '+audio.src));};
      audio.addEventListener('loadeddata',ready);audio.addEventListener('error',error);
    });
    const decoded=[];
    for(const track of catalog.music){
      const audio=new Audio('/'+track.asset);audio.preload='auto';await mediaReady(audio);
      if(!Number.isFinite(audio.duration) || audio.duration<=0)throw new Error('Invalid source duration');
      decoded.push({name:track.name,duration:audio.duration});audio.removeAttribute('src');audio.load();
    }
    // Decode every unchanged WAV with the browser's actual Web Audio decoder.
    const context=new AudioContext();const decodedSounds=[];
    try{
      for(const track of catalog.sounds){
        const response=await fetch('/'+track.asset);if(!response.ok)throw new Error('WAV fetch '+track.name);
        const buffer=await context.decodeAudioData(await response.arrayBuffer());
        if(buffer.length<=0 || buffer.duration<=0)throw new Error('Empty WAV '+track.name);
        let peak=0;
        for(let channel=0;channel<buffer.numberOfChannels;channel++){
          for(const sample of buffer.getChannelData(channel)){
            if(!Number.isFinite(sample))throw new Error('Nonfinite WAV '+track.name);
            peak=Math.max(peak,Math.abs(sample));
          }
        }
        decodedSounds.push({name:track.name,duration:buffer.duration,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels,peak});
      }
    }finally{await context.close();}
    const {BattleMusic}=await import('/src/audio/battle-music.ts');const music=new BattleMusic();
    const audio=music.audio;const maps=[];
    for(const row of catalog.maps){
      await music.play(row.mode,row.mapId);await mediaReady(audio);
      if(!audio.src.endsWith('/'+row.asset) || audio.dataset.musicId!==String(row.musicId) || !audio.loop || audio.volume!==.5)throw new Error('Map music source mismatch');
      maps.push({mode:row.mode,mapId:row.mapId,musicId:row.musicId,src:audio.src,duration:audio.duration});
    }
    await new Promise(r=>setTimeout(r,400));
    if(audio.paused || audio.currentTime<=0 || audio.dataset.state!=='playing')throw new Error('Actual media playback did not advance '+JSON.stringify({paused:audio.paused,time:audio.currentTime,state:audio.dataset.state,error:audio.error?.message}));
    const playback={time:audio.currentTime,state:audio.dataset.state};
    music.setVolume(0);if(audio.volume!==0)throw new Error('Mute');
    await music.play(catalog.maps[0].mode,catalog.maps[0].mapId);await mediaReady(audio);
    if(audio.volume!==0)throw new Error('Map switch lost volume');
    music.setVolume(.25);if(audio.volume!==.25)throw new Error('Volume change');
    music.stop();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));
    if(!audio.paused || audio.hasAttribute('src') || audio.dataset.musicId || audio.dataset.state!=='stopped')throw new Error('Stop retained media');
    // Leave while the catalog request is pending: no late playback or source assignment.
    const originalFetch=window.fetch;let release;
    window.fetch=(...args)=>String(args[0])==='/audio.json'?new Promise(r=>{release=()=>r(new Response(JSON.stringify(catalog)));}):originalFetch(...args);
    const pending=new BattleMusic();const playing=pending.play(catalog.maps[0].mode,catalog.maps[0].mapId);
    pending.stop();release();await playing;window.fetch=originalFetch;
    if(pending.audio.hasAttribute('src') || !pending.audio.paused || pending.audio.dataset.state!=='stopped')throw new Error('Late catalog revived audio');
    const {BattleSound}=await import('/src/audio/battle-sound.ts');const sound=new BattleSound();
    await sound.start();await sound.context.resume();
    const local={id:'local',team:0,tankId:1,x:0,y:0,z:0};
    const attacker={id:'attacker',team:0,tankId:1,x:0,y:0,z:-100};
    const snapshot={roomId:'fixture',mode:1,players:[local,attacker]};
    const event={roomId:'fixture',type:'destroy',playerId:'attacker',targetId:'victim'};
    sound.listener({x:0,y:0,z:0},{x:0,y:0,z:-1},{x:0,y:1,z:0});
    // Inspect a real playing Web Audio graph and measure nonzero output samples.
    const analyser=sound.context.createAnalyser();analyser.fftSize=2048;sound.gain.connect(analyser);
    sound.event(event,snapshot,'local');
    const voice=[...sound.voices][0];
    if(!voice || voice.source.loop || voice.panner.rolloffFactor!==0 || voice.attenuation.gain.value!==1 || sound.gain.gain.value!==.5)throw new Error('Original spatial graph mismatch');
    let peak=0;const samples=new Float32Array(2048);
    for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,20));analyser.getFloatTimeDomainData(samples);for(const value of samples)peak=Math.max(peak,Math.abs(value));}
    if(peak<=0)throw new Error('WAV output did not reach audio graph');
    const actualWav={soundId:sound.history[0].soundId,peak,contextTime:sound.context.currentTime};
    await new Promise(r=>setTimeout(r,700));
    if(sound.voices.size!==0)throw new Error('Ended voice leaked');
    sound.stop();await sound.start();await sound.context.resume();
    for(const mode of [1,2,3,4,5]){
      snapshot.mode=mode;attacker.team=1;sound.event(event,snapshot,'local');
      if(sound.history.length!==(mode<4?0:mode-3))throw new Error('Enemy sound routing mode '+mode);
    }
    const modeRouting=[...sound.history];sound.stop();await sound.start();await sound.context.resume();
    const skillSelections=[];
    snapshot.mode=1;attacker.team=1;
    for(const row of catalog.battleFire){
      sound.event({...event,type:'fire',skillId:row.skillId},snapshot,'local');
      const last=sound.history.at(-1);
      if(last?.soundId!==row.soundId || last?.skillId!==row.skillId || last?.type!=='fire')throw new Error('Skill sound routing '+row.skillId);
      skillSelections.push({skillId:row.skillId,soundId:last.soundId});
    }
    const count=sound.history.length;
    for(const skillId of [undefined,2000,2022])sound.event({...event,type:'fire',skillId},snapshot,'local');
    if(sound.history.length!==count)throw new Error('Unknown skill substituted');
    sound.stop();await sound.start();await sound.context.resume();
    snapshot.mode=1;attacker.team=0;
    const tankSelections=[];
    for(const row of catalog.battleKill.tankTypes){
      attacker.tankId=row.id;sound.event(event,snapshot,'local');
      const expected=catalog.battleKill.selections.find(s=>s.tankType===row.type)?.soundId??41;
      const last=sound.history.at(-1);if(last.soundId!==expected)throw new Error('Tank sound ID '+row.id);
      tankSelections.push({tankId:row.id,type:row.type,soundId:last.soundId});
    }
    sound.setVolume(0);if(sound.gain.gain.value!==0)throw new Error('Sound mute');
    sound.setVolume(.25);sound.stop();await sound.start();await sound.context.resume();
    if(sound.gain.gain.value!==.25)throw new Error('Sound volume lost on reentry');
    await sound.context.suspend();sound.event(event,snapshot,'local');await sound.context.resume();
    if(sound.history.length!==0)throw new Error('Suspended one shot replayed');
    sound.event(event,snapshot,'local');sound.stop();
    if(sound.voices.size || sound.history.length || sound.gain.gain.value!==0)throw new Error('Stop retained sound');
    // Offline contexts run the actual runtime event graph with deterministic source samples.
    const distances=[];
    for(const distance of [0,100,475,850,1600,2000]){
      const offline=new OfflineAudioContext(2,4096,48000);
      Object.defineProperty(offline,'state',{value:'running'});
      const fixture=new BattleSound();fixture.context=offline;fixture.catalog=catalog;fixture.active=true;
      fixture.gain=offline.createGain();fixture.gain.gain.value=.5;fixture.gain.connect(offline.destination);
      fixture.buffers.set(55,sound.buffers.get(55));
      attacker.tankId=1;attacker.z=-distance;
      fixture.listener({x:0,y:0,z:0},{x:0,y:0,z:-1},{x:0,y:1,z:0});
      fixture.event(event,snapshot,'local');
      const factor=[...fixture.voices][0].attenuation.gain.value;
      const output=await offline.startRendering();let energy=0;
      for(const sample of output.getChannelData(0))energy+=sample*sample;
      distances.push({distance,factor,rms:Math.sqrt(energy/output.length)});
    }
    const baseline=distances[1].rms;
    if(baseline<=0)throw new Error('Offline WAV has no signal');
    for(const row of distances){const expected=Math.max(0,1-2*(Math.max(100,Math.min(1600,row.distance))-100)/1500);
      if(Math.abs(row.factor-expected)>1e-6 || Math.abs(row.rms/baseline-expected)>1e-5)throw new Error('Original rolloff output '+JSON.stringify(row));}
    const fireOutput=[];
    for(const row of catalog.battleFire.filter((row,index,rows)=>rows.findIndex(other=>other.soundId===row.soundId)===index)){
      const offline=new OfflineAudioContext(2,24000,48000);Object.defineProperty(offline,'state',{value:'running'});
      const fixture=new BattleSound();fixture.context=offline;fixture.catalog=catalog;fixture.active=true;
      fixture.gain=offline.createGain();fixture.gain.gain.value=.5;fixture.gain.connect(offline.destination);
      fixture.buffers.set(row.soundId,sound.buffers.get(row.soundId));attacker.z=-100;
      fixture.listener({x:0,y:0,z:0},{x:0,y:0,z:-1},{x:0,y:1,z:0});
      fixture.event({...event,type:'fire',skillId:row.skillId},snapshot,'local');
      const output=await offline.startRendering();let peak=0;
      for(const sample of output.getChannelData(0))peak=Math.max(peak,Math.abs(sample));
      if(peak<=0)throw new Error('No actual fire sound output '+row.skillId);
      fireOutput.push({skillId:row.skillId,soundId:row.soundId,peak});
    }
    let finishCatalog;window.fetch=(...args)=>String(args[0])==='/audio.json'?new Promise(r=>{finishCatalog=()=>r(new Response(JSON.stringify(catalog)));}):originalFetch(...args);
    const lateSound=new BattleSound();const starting=lateSound.start();lateSound.stop();finishCatalog();await starting;window.fetch=originalFetch;
    if(lateSound.active || lateSound.context || lateSound.voices.size)throw new Error('Late sound catalog revived battle');
    await sound.context.close();
    return {decoded,decodedSounds,maps,playback,volume:true,stop:true,pendingExit:true,
      battleSound:{actualWav,modeRouting,skillSelections,fireOutput,tankSelections,distances,endedCleanup:true,stop:true,pendingExit:true,suspendedDrop:true}};
  })()`);
  assert.equal(evidence.decoded.length, 14);
  assert.equal(evidence.decodedSounds.length, 174);
  assert.equal(evidence.maps.length, 26);
  assert.equal(evidence.battleSound.tankSelections.length, 21);
  assert.equal(evidence.battleSound.skillSelections.length, 21);
  assert.equal(evidence.battleSound.fireOutput.length, 4);
  await writeFile('recovery/output/browser-audio.json', JSON.stringify(evidence, null, 2));
  console.log('PASS: 14 MP3 and 174 WAV browser decodes, 26 original mode/map selections, real music playback, volume, stop and pending-load exit');
  console.log('PASS: real kill WAV graph/output, 21 tank selections, five-mode routing, original 100/1600/2 attenuation output and sound lifecycle');
  console.log('PASS: 21 source skill-fire selections and four original firing WAV outputs');
} finally {
  for (const targetId of pages) await command('Target.closeTarget', {targetId});
  ws.close();
}
