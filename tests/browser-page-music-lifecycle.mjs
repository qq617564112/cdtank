import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3420',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-page-music-lifecycle-consumers-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-page-music-lifecycle-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3420,vite:5450,cdp:9650},runId,scope:'One ordinary formal lobby/CreateRoom/threeCPU/Ready/Leave lifecycle selecting original UIM01/UIM02/map music. Real gestures, no autoplay bypass, read-only media captureStream samples; no BUY/damage/result-rule replay.'};
async function stop(child){if(child?.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
let sequence = 0;
const pending = new Map();
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
async function waitUntil(session, expression, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('[data-tank-shop-status]')?.value+' '+document.querySelector('[data-tank-shop-preview]')?.dataset.status);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')
          && !String(error).includes('Inspected target navigated or closed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
async function nativeClick(session, selector) {
  await command('Page.bringToFront', {}, session);await new Promise(r=>setTimeout(r,100));
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control covered '+e.outerHTML+' by '+document.elementFromPoint(x,y)?.outerHTML);return {x,y}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',buttons:1,clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3420',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',
    publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-music-observation',transform(source,id){
      if(id.endsWith('/src/match/battle.ts')) return source+'\nconst oldMusicQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.musicBattle=this;return oldMusicQuick.call(this,value);};';
      if(id.endsWith('/src/audio/battle-music.ts')) return source+'\nconst oldMusicDispose=BattleMusic.prototype.dispose;BattleMusic.prototype.dispose=function(){oldMusicDispose.call(this);console.info("CDTANK_MUSIC_DISPOSE",JSON.stringify({audioCount:document.querySelectorAll(\"audio[data-source-audio=\\\"battle-music\\\"]\").length,paused:this.audio.paused,src:this.audio.getAttribute(\"src\"),state:this.audio.dataset.state}));};';
    }}],server:{port:5450,strictPort:true,host:'127.0.0.1',hmr:false,
      proxy:{'/game':{target:'ws://127.0.0.1:3420',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling',
    '--disable-renderer-backgrounding','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--remote-debugging-port=9650',`--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;
  for(let i=0;i<100;i++) {try {endpoint=(await(await fetch('http://127.0.0.1:9650/json/version')).json()).webSocketDebuggerUrl;break;}
    catch {await new Promise(resolve=>setTimeout(resolve,50));}}
  assert(endpoint);ws=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  ws.on('message',raw=>{
    const message=JSON.parse(String(raw)),callback=pending.get(message.id);
    if(callback){pending.delete(message.id);message.error?callback.reject(new Error(JSON.stringify(message.error))):callback.resolve(message.result);}
    if(message.method==='Runtime.bindingCalled'&&message.params.name==='musicCleanupObserved') evidence.disposal=JSON.parse(message.params.payload);
    if(message.method==='Runtime.consoleAPICalled'&&message.params.args[0]?.value==='CDTANK_MUSIC_DISPOSE') evidence.disposal=JSON.parse(message.params.args[1].value);
    if(message.method==='Runtime.exceptionThrown') (evidence.browserExceptions??=[]).push(message.params.exceptionDetails);
    if(message.method==='Network.webSocketFrameReceived'||message.method==='Network.webSocketFrameSent') {
      const {opcode,payloadData}=message.params.response;if(opcode!==2)return;
      const bytes=new Uint8Array(Buffer.from(payloadData,'base64'));
      if(bytes.length===1&&bytes[0]===0)return;
      const received=message.method.endsWith('Received');let result;
      if(received)result=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);
      else {
        const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);
        const service=decoder.serviceMap.id2Service[envelope.value.serviceId];
        const payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);
        result={isSucc:true,result:{service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};
      }
      if(!result.isSucc)return;const value=result.result;
      if(!['CreateRoom','Join','Leave','Ready','Cpu','RoomChat','RoomWhisper','Shop','TankShop','PetShop'].includes(value.service.name))return;
      network.push({direction:received?'received':'sent',name:value.service.name,
        ...(value.ret?{success:value.ret.isSucc}:{}),...(value.msg?{payload:value.msg}:{})});
    }
  });
  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
  const {sessionId:s}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId:s});
  await command('Page.enable',{},s);await command('Runtime.enable',{},s);await command('Network.enable',{},s);
  await command('Runtime.addBinding',{name:'musicCleanupObserved'},s);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
  await command('Page.navigate',{url:'http://127.0.0.1:5450'},s);
  const audio='audio[data-source-audio="battle-music"]';
  const readAudio=()=>evaluate(s,`(()=>{const a=document.querySelector('${audio}');return {id:a.dataset.musicId,state:a.dataset.state,src:a.getAttribute('src'),paused:a.paused,loop:a.loop,volume:a.volume,currentTime:a.currentTime,count:document.querySelectorAll('${audio}').length,activation:navigator.userActivation.hasBeenActive}})()`);
  async function music(id) {await waitUntil(s,`document.querySelector('${audio}')?.dataset.musicId==='${id}'&&document.querySelector('${audio}')?.dataset.state==='playing'&&!document.querySelector('${audio}').paused`);return readAudio();}
  async function wave() {return evaluate(s,`(async()=>{const a=document.querySelector('${audio}'),stream=a.captureStream(),c=new AudioContext();await c.resume();const source=c.createMediaStreamSource(stream),analyser=c.createAnalyser(),mute=c.createGain();mute.gain.value=0;source.connect(analyser);analyser.connect(mute);mute.connect(c.destination);const samples=new Float32Array(analyser.fftSize);let peak=0,sum=0,count=0;for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,20));analyser.getFloatTimeDomainData(samples);for(const x of samples){peak=Math.max(peak,Math.abs(x));sum+=x*x;count++;}}source.disconnect();analyser.disconnect();mute.disconnect();await c.close();return {peak,rms:Math.sqrt(sum/count),tracks:stream.getAudioTracks().length,mediaVolume:a.volume,scope:'Read-only captureStream media samples, not final speaker or postmaster output.'};})()`);}
  await waitUntil(s,`document.querySelector('[data-room-card-create]')?.matches(':enabled')&&document.querySelector('${audio}')?.dataset.musicId==='183'&&localStorage.getItem('cdtank-account-token')`);
  evidence.initialLobby=await readAudio();assert.equal(evidence.initialLobby.count,1);
  if(process.argv.includes('--dispose-only')) {
    await nativeClick(s,'[data-room-card-home]');await music(183);
    evidence.disposeWrapper=await evaluate(s,`window.musicBattle.music.dispose.toString()`);
    await command('Page.navigate',{url:'http://127.0.0.1:5450/audio.json'},s);
    const deadline=Date.now()+10000;while(!evidence.disposal&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
    assert.deepEqual(evidence.disposal,{audioCount:0,paused:true,src:null,state:'stopped'});
    evidence.disposeOnly=true;evidence.status='PASS_PAGE_MUSIC_DISPOSE_ONLY_SCOPE';
  } else {
  await nativeClick(s,'[data-room-card-create]');evidence.lobby=await music(183);evidence.lobbyWave=await wave();assert(evidence.lobbyWave.peak>0);
  await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')`);
  await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');
  evidence.lobbyAfterDraft=await music(183);assert(evidence.lobbyAfterDraft.currentTime>evidence.lobby.currentTime);
  await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);
  await nativeClick(s,'[data-room-create-confirm]');
  await waitUntil(s,`document.querySelector('[data-add-cpu]')?.matches(':enabled')&&!document.querySelector('[data-room-create-dialog]')?.open`);
  evidence.waiting=await music(184);evidence.waitingWave=await wave();assert(evidence.waitingWave.peak>0);
  assert(await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='WAITING'`));
  for(let i=0;i<3;i++) {
    await nativeClick(s,'[data-add-cpu]');
    await waitUntil(s,`JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')?.players.length>=${i+2}&&document.querySelector('[data-add-cpu]')?.matches(':enabled')`);
  }
  await waitUntil(s,`window.musicBattle?.mapLoaded&&window.musicBattle.players.resourcesReady&&!window.musicBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);
  evidence.waitingLoaded=await music(184);assert(evidence.waitingLoaded.currentTime>evidence.waiting.currentTime);
  await nativeClick(s,'[data-waiting-ready]');await waitUntil(s,`document.querySelector('[data-formal-battle-page]')`);
  const mapId=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).mapId`);
  const mode=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).mode`);
  const track=await evaluate(s,`(async()=>{const c=await(await fetch('/audio.json')).json();return c.maps.find(m=>m.mode===${mode}&&m.mapId===${mapId})})()`);
  evidence.map=await music(track.musicId);evidence.mapWave=await wave();assert(evidence.mapWave.peak>0);
  assert(evidence.map.src.endsWith(track.asset));
  await nativeClick(s,'[data-leave-room]');await waitUntil(s,`!document.querySelector('[data-formal-battle-page]')&&document.activeElement.matches('[data-room-card-create]')`);
  evidence.returnedLobby=await music(183);assert(evidence.returnedLobby.loop);assert.equal(evidence.returnedLobby.count,1);
  // The ordinary settings panel owns the persisted music preference.
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('#open-quick-chat-settings')?.matches(':enabled')`);
  await nativeClick(s,'#open-quick-chat-settings');
  await waitUntil(s,`document.querySelector('[data-settings-volume="music"]')`);
  await nativeClick(s,'[data-settings-volume="music"]');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36},s);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36},s);
  await waitUntil(s,`document.querySelector('[data-settings-volume="music"]').value==='0'&&document.querySelector('${audio}').volume===0`);
  evidence.mutedLobby=await readAudio();assert.equal(evidence.mutedLobby.volume,0);
  await nativeClick(s,'[data-settings-close]');
  evidence.status='PASS_PAGE_MUSIC_SELECTION_WAVE_RETURN_SCOPE';
  await command('Page.navigate',{url:'about:blank'},s);
  const deadline=Date.now()+10000;while(!evidence.disposal&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
  assert.deepEqual(evidence.disposal,{audioCount:0,paused:true,src:null,state:'stopped'});
  evidence.status='PASS_PAGE_MUSIC_SELECTION_WAVE_RETURN_DISPOSE_SCOPE';
  assert(!network.some(n=>n.direction==='sent'&&['Shop','TankShop','PetShop','RoomChat','RoomWhisper'].includes(n.name)));
  }
  console.log('PASS '+output);
} catch(error) {evidence.status='FAIL';evidence.error=String(error);throw error;}
finally {
  evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  await writeFile(output+'.log',serverLog);
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
