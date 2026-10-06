import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3382',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-pet-owned-details-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-pet-details-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3382,vite:5432,cdp:9632},runId,scope:'UI34 original Home pet main owned attributes/6skills/info, confirmed candidate query, original row images as read-only Web projection; no learning or SelectRole.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3382',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5432,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3382',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9632',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9632/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9632');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5432',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;

  store=new AccountStore(database);const account=store.open(await evaluate(s,`localStorage.getItem('cdtank-account-token')`));
  const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0x70,10000,true);view.setUint32(0x74,1000,true);
  store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;
  evidence.fixture={initialMoney:10000,initialTokens:1000,initialOwnedPets:0,rolesNotImported:true};
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Pet"]');await waitUntil(s,`document.querySelector('[data-pet-shop-product-id="2"]')?.matches(':enabled')`);
  for(const petId of (process.argv.includes('--layout-only')?[103]:[2,103])){
    await nativeClick(s,'[data-pet-shop-product-id="'+petId+'"]');await waitUntil(s,`document.querySelector('[data-pet-shop-buy]')?.matches(':enabled')`);
    await nativeClick(s,'[data-pet-shop-buy]');await waitUntil(s,`document.querySelector('[data-pet-shop-status]')?.textContent.includes('已购买')&&document.querySelector('[data-pet-shop-buy]')?.matches(':enabled')`);
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-shop]')`);
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-name-open]')?.matches(':enabled')`);
  await nativeClick(s,'#home-inventory [data-role-tab="pet"]');await waitUntil(s,`document.querySelectorAll('#home-roles [data-owned-role]').length===${process.argv.includes('--layout-only')?1:2}`);
  const owned=network.filter(row=>row.name==='OwnedRoles'&&row.success).at(-1).response.base;
  const catalog=await evaluate(s,`fetch('/combat-catalog.json').then(r=>r.json())`);
  evidence.candidates=[];
  for(const record of owned){
    const fields=new Map(record.fields),instanceId=fields.get(0),petId=fields.get(8);
    await nativeClick(s,'#home-roles [data-owned-role="'+instanceId+'"]');
    await waitUntil(s,`document.querySelector('[data-source-control="txtLife"][data-owned-value]')?.dataset.ownedValue==='${fields.get(0x2c)}'&&document.querySelector('[data-home-pet-owned-description]')?.textContent.length>0`);
    const actual=await evaluate(s,`(()=>{const root=document.querySelector('#home-roles');return {name:root.querySelector('[data-source-control="txtPetName"]').textContent,attributes:[...root.querySelectorAll('[data-home-pet-owned-field]')].map(e=>({offset:Number(e.dataset.homePetOwnedField),value:Number(e.dataset.ownedValue)})),skills:[...root.querySelectorAll('[data-home-pet-skill]')].map(e=>({id:Number(e.dataset.skillId),level:Number(e.dataset.skillLevel),name:e.querySelector('[data-source-control^="txtSkillName"]').textContent})),description:root.querySelector('[data-home-pet-owned-description]').textContent}})()`);
    assert.equal(actual.name,record.name);for(const value of actual.attributes)assert.equal(value.value,fields.get(value.offset));
    actual.skills.forEach((skill,i)=>{assert.equal(skill.id,fields.get(0x44+i*4));assert.equal(skill.level,fields.get(0x5c+i*4));assert.equal(skill.name,catalog.skills.find(definition=>definition.skillId===skill.id)?.name??'');});
    const product=network.filter(row=>row.name==='PetShop'&&row.success).at(-1).response.pets.find(product=>product.petId===petId);assert.equal(actual.description,product.info);
    evidence.candidates.push({instanceId,petId,...actual});
  }
  evidence.resolutions=[];
  for(const [width,height]of (process.argv.includes('--layout-only')?[[1920,1080]]:[[800,600],[1920,1080],[3840,2160]])){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await waitUntil(s,`Math.abs(document.querySelector('.home-roles-stage').getBoundingClientRect().width-625*Math.min(innerWidth/800,innerHeight/600))<.2`);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    evidence.skillGeometry=await evaluate(s,`[...document.querySelectorAll('[data-home-pet-skill]')].map(e=>{const row=e.querySelector('.source-static-image').getBoundingClientRect(),name=e.querySelector('[data-source-control^="txtSkillName"]').getBoundingClientRect(),level=e.querySelector('[data-source-control^="txtSkillLevel"]').getBoundingClientRect();return {nameWithinRow:name.x>=row.x&&name.y>=row.y&&name.right<=row.right&&name.bottom<=row.bottom,levelWithinRow:level.x>=row.x&&level.y>=row.y&&level.right<=row.right&&level.bottom<=row.bottom}})`);assert(evidence.skillGeometry.every(row=>row.nameWithinRow&&row.levelWithinRow));const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));evidence.resolutions.push({width,height});
  }
  await nativeClick(s,'[data-roles-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);
  assert(!network.some(row=>row.name==='SelectRole'&&row.direction==='sent'));evidence.noSelectRole=true;evidence.finalHomeFocus=true;
  evidence.status='PASS';console.log('PASS confirmed owned pet information: '+evidence.candidates.length+' candidates / '+evidence.resolutions.length+' resolutions / no learning or SelectRole / source Close focus');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
