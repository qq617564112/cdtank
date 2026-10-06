import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3377',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-battle-summary-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-summary-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const navigationOnly=process.argv.includes('--navigation-only');
const leaveFocusOnly=process.argv.includes('--leave-focus-only');

const evidence={status:'RUNNING',ports:{server:3377,vite:5427,cdp:9627},runId,scope:'UI19 source game_summary two normal accounts mode1/map7 natural TIME_LIMIT, actual frozen teams/results/3res/rematch/Leave; original rewards and score semantics unproved.'};
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
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3377',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5427,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3377',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9627',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9627/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9627');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['TankShop','SelectRole','Rematch','RoomSnapshot','Ready','Leave','Account'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<(leaveFocusOnly?1:2);index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5427',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  if(leaveFocusOnly){
    const s=pages[0].sessionId;
    await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-mode="1"]')`);
    await nativeClick(s,'[data-map-selector-mode="1"]');await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');
    await waitUntil(s,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(s,'[data-room-create-confirm]');
    await waitUntil(s,`document.querySelector('[data-waiting-close]')?.matches(':enabled')&&!document.querySelector('[data-room-create-dialog][open]')`);
    await nativeClick(s,'[data-waiting-close]');
    await waitUntil(s,`!document.querySelector('#battle-status').dataset.world&&!document.querySelector('[data-lobby-page]').hidden&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);
    evidence.leaveFocus=await evaluate(s,`({focusTag:document.activeElement.tagName,focusCreate:document.activeElement.matches('[data-room-card-create]'),enabled:document.activeElement.matches(':enabled'),lobbyVisible:!document.querySelector('[data-lobby-page]').hidden})`);
    assert(evidence.leaveFocus.focusCreate&&evidence.leaveFocus.enabled);
    await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-mode="1"]')`);evidence.leaveFocus.normalReopen=true;
    evidence.status='PASS';console.log('PASS directed ordinary room Leave strict actual enabled formalCreate focus and normal reopen; no BUY/rematch/resolution/finish repeated');
  }else{
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  for(const {sessionId:s}of pages)await evaluate(s,`(async()=>{const {Battle}=await import('/src/match/battle.ts');const original=Battle.prototype.reconcile;Battle.prototype.reconcile=function(...args){window.summaryBattle=this;return original.apply(this,args)}})()`);
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')`);
  store=new AccountStore(database);
  for(const page of pages){const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));const bytes=new Uint8Array(0x170);new DataView(bytes.buffer).setUint32(0x70,4000,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});}
  store.close();store=undefined;evidence.fixture={fundsOnly:4000,ownedRolesImported:false};
  for(const {sessionId:s} of pages){
    await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);await nativeClick(s,'[data-shop-root-category="Tank"]');await waitUntil(s,`document.querySelector('[data-tank-shop-product-id="3"]')?.matches(':enabled')`);await nativeClick(s,'[data-tank-shop-product-id="3"]');await nativeClick(s,'[data-tank-shop-buy]');await waitUntil(s,`document.querySelector('[data-tank-shop-status]').value.includes('已购买')`);
    await nativeClick(s,'[data-shop-close]');await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-role-tab="tank"]')?.matches(':enabled')`);await nativeClick(s,'[data-role-tab="tank"]');await waitUntil(s,`document.querySelector('[data-owned-role="1"]')?.matches(':enabled')`);await nativeClick(s,'[data-owned-role="1"]');await nativeClick(s,'.home-tank-source-use');await waitUntil(s,`document.querySelector('.home-tank-source-use').dataset.selectedInstance==='1'&&document.querySelector('#home-roles').getAttribute('aria-busy')==='false'`);await nativeClick(s,'[data-roles-close]');
  }
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="1"]')`);await nativeClick(host,'[data-map-selector-mode="1"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world&&!document.querySelector('[data-room-create-dialog][open]')`);
  const roomId=(await world(host)).roomId;await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);await nativeClick(guest,`[data-room-card-id="${roomId}"]`);await nativeClick(guest,'[data-room-card-express]');
  for(const {sessionId:s}of pages){await waitUntil(s,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.mapLoaded&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);}
  for(const {sessionId:s}of pages)await waitUntil(s,`window.summaryBattle?.mapLoaded&&window.summaryBattle.players.resourcesReady&&!window.summaryBattle.players.loadingError`,120000);
  await nativeClick(guest,'[data-waiting-team="1"]');
  for(const s of [guest,host])await nativeClick(s,'[data-waiting-ready]');
  for(const {sessionId:s}of pages)await waitUntil(s,`document.querySelector('[data-phase="PLAYING"]')`);
  evidence.playing=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const {sessionId:s}of pages){await nativeClick(s,'#world');await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},s);}
  console.log('Normal two-account mode1/map7 PLAYING; ordinary Space then natural TIME_LIMIT');
  for(const {sessionId:s}of pages)await waitUntil(s,`document.querySelector('[data-battle-summary-page]')?.getAttribute('aria-busy')==='false'`,60000);
  for(const {sessionId:s}of pages)await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},s);
  evidence.finished=await Promise.all(pages.map(p=>world(p.sessionId)));
  const frozen=evidence.finished[0].match.result;
  assert.equal(frozen.reason,'TIME_LIMIT');assert.deepEqual(evidence.finished[1].match.result,frozen);
  async function readRows(s){return evaluate(s,`[...document.querySelectorAll('[data-summary-slot]')].map(e=>({slot:e.dataset.summarySlot,team:Number(e.dataset.summaryTeam),id:e.dataset.summaryPlayer??null,rank:Number(e.dataset.summaryRank)||null,name:e.querySelector('[data-summary-name]')?.textContent??null,combat:Number(e.querySelector('[data-summary-combat]')?.textContent??0),bonus:Number(e.querySelector('[data-summary-bonus]')?.textContent??0),total:Number(e.querySelector('[data-summary-total]')?.dataset.summaryTotal??0),self:e.dataset.summarySelf??null}))`);}
  evidence.rows=await Promise.all(pages.map(p=>readRows(p.sessionId)));
  for(const [i,rows]of evidence.rows.entries()){
    assert.equal(rows.length,12);
    for(const team of [0,1]){const expected=frozen.players.filter(p=>p.team===team).sort((a,b)=>a.rank-b.rank);const rendered=rows.filter(r=>r.team===team&&r.id);assert.deepEqual(rendered.map(r=>r.id),expected.map(p=>p.id));for(const row of rendered){const p=expected.find(p=>p.id===row.id);assert.equal(row.name,p.name);assert.equal(row.combat,p.combatScore);assert.equal(row.bonus,p.outcomeBonus);assert.equal(row.total,p.totalScore);assert.equal(row.self,String(row.id===evidence.finished[i].playerId));}}
  }
  evidence.nonzeroCombat=frozen.players.some(p=>p.combatScore>0);
  if(!navigationOnly){evidence.sizes=[];
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},host);
    await evaluate(host,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const box=await evaluate(host,`(()=>{const e=document.querySelector('[data-battle-summary-page]'),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,assets:[...e.querySelectorAll('[data-source-asset]')].map(e=>e.dataset.sourceAsset)}})()`);
    assert(Math.abs(box.width-800*Math.min(width/800,height/600))<1);assert(Math.abs(box.height-600*Math.min(width/800,height/600))<1);
    evidence.sizes.push({viewport:{width,height},stage:box});const shot=await command('Page.captureScreenshot',{format:'png'},host);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},host);
  await evaluate(host,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  await evaluate(host,`(()=>{window.summaryVoteStates=[];const record=()=>{const b=document.querySelector('[data-rematch]');if(b)window.summaryVoteStates.push({text:b.textContent,disabled:b.disabled,status:document.querySelector('.battle-summary-status')?.textContent})};new MutationObserver(record).observe(document.querySelector('[data-battle-summary-page]'),{subtree:true,attributes:true,childList:true,characterData:true});record()})()`);
  await nativeClick(host,'[data-rematch]');await waitUntil(host,`document.querySelector('[data-rematch]').textContent==='已确认再战'`);
  evidence.firstVote={world:await world(host),states:await evaluate(host,`window.summaryVoteStates`)};
  assert(evidence.firstVote.states.some(s=>s.text==='正在提交…'&&s.disabled));assert.deepEqual(evidence.firstVote.world.match.result,frozen);assert.deepEqual((await world(guest)).match.result,frozen);assert.equal(await evaluate(host,`document.querySelector('[data-rematch]').disabled`),true);
  await nativeClick(guest,'[data-rematch]');for(const {sessionId:s}of pages)await waitUntil(s,`document.querySelector('[data-phase="PLAYING"][data-round="2"]')`);
  evidence.rematch=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const {sessionId:s}of pages)await waitUntil(s,`document.querySelector('[data-battle-summary-page][data-summary-round="2"]')?.getAttribute('aria-busy')==='false'`,60000);
  evidence.secondFinished=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const {sessionId:s}of pages){await nativeClick(s,'[data-summary-leave]');await waitUntil(s,`!document.querySelector('[data-battle-summary-page]')&&!document.querySelector('#battle-status').dataset.world&&!document.querySelector('[data-lobby-page]').hidden`);}
  evidence.leave=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({focusTag:document.activeElement.tagName,focusCreate:document.activeElement.matches('[data-room-card-create]'),lobbyVisible:!document.querySelector('[data-lobby-page]').hidden})`)));
  assert(evidence.leave.every(p=>p.focusCreate),'Source Close returns actual formal lobby focus');
  evidence.status='PASS';console.log('PASS natural frozen dual results/source12slots/three resolutions/pending-voted/unanimous round2/Close lobby focus');
  }
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
