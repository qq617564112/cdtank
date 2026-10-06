import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3606',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-pet-skill-learning-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-learning-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const unreachedTail=process.argv.includes('--unreached-tail');
const tailIndex=process.argv.indexOf('--unreached-tail');
const fixtureSource='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
const fixturePath=unreachedTail?process.argv[tailIndex+1]:undefined;
assert(!unreachedTail||fixturePath&&!fixturePath.startsWith('--'),'Tail requires explicit committed checkpoint fixture');
const fixture=unreachedTail?JSON.parse(await readFile(fixturePath,'utf8')):
  JSON.parse(await readFile(fixtureSource+'-identity.private.json','utf8')).accounts[1];
const checkpoint=unreachedTail?fixture.database:fixtureSource+'-checkpoint.sqlite';
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
if(!unreachedTail){
  const db=new DatabaseSync(database);
  try{
    const row=db.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(fixture.accountId);assert(row);
    const bytes=Uint8Array.from(row.payload),view=new DataView(bytes.buffer);
    view.setUint32(0x80,400,true);
    db.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes,fixture.accountId);
  }finally{db.close();}
}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,ports:{server:3606,vite:5636,cdp:9836},
  scope:unreachedTail?'Only committed Pet instance3 slot4 disabled observer, slot0 two Learn10/20 and Close/reopen; zero BUY/Point injection/screenshots/slot4 Learn':'New ordinary Pet2 BUY rank0, slot4 Learn then slot0 twice, source quote/next description/points three whole frames, confirmed Close/reopen; no old slot/escape or network restart suite',
  unreachedTail,fixturePath,fixture:{source:checkpoint,preServiceSkillPoints:unreachedTail?200:400,earnedPointsProved:false,fundsInjected:false,ownedRecordsInjected:false}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3606',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5636,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3606',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9836',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9836/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9836');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['PetSkillLearning','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5636'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  const lastLearning=()=>network.filter(n=>n.name==='PetSkillLearning'&&n.direction==='received'&&n.success).at(-1)?.response;
  let instanceId=3;
  if(!unreachedTail){
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Pet"]');
  await waitUntil(s,`document.querySelector('[data-pet-shop-product-id="2"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-pet-shop-product-id="2"]');
  await waitUntil(s,`document.querySelector('[data-pet-shop-buy]')?.matches(':enabled')`);
  await nativeClick(s,'[data-pet-shop-buy]');
  await waitUntil(s,`document.querySelector('[data-pet-shop-status]')?.textContent.includes('已购买')&&document.querySelector('[data-pet-shop-buy]')?.matches(':enabled')`);
  const purchase=network.filter(n=>n.name==='PetShop'&&n.direction==='received'&&n.success&&n.response?.purchased).at(-1)?.response;
  assert(purchase?.purchased);evidence.purchase=purchase;
  const fields=new Map(purchase.purchased.fields);instanceId=fields.get(0);
  assert.deepEqual(Array.from({length:6},(_,i)=>fields.get(0x5c+i*4)),[0,0,0,0,0,0]);
  evidence.instanceId=instanceId;
  await nativeClick(s,'[data-shop-close]');
  await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);
  }
  evidence.instanceId=instanceId;
  async function openHome(){
    await nativeClick(s,'[data-room-card-home]');
    await waitUntil(s,`document.querySelector('#home-inventory [data-role-tab="pet"]')?.matches(':enabled')`);
    await nativeClick(s,'#home-inventory [data-role-tab="pet"]');
    await waitUntil(s,`document.querySelector('#home-roles [data-owned-role="${instanceId}"]')?.matches(':enabled')`);
    await nativeClick(s,'#home-roles [data-owned-role="'+instanceId+'"]');
    await waitUntil(s,`document.querySelector('[data-home-pet-view-skill="4"]')?.matches(':enabled')`);
  }
  async function openSlot(slot){
    const record=lastLearning().owned.base.find(r=>new Map(r.fields).get(0)===instanceId);assert(record);
    const ownedFields=new Map(record.fields),baseId=ownedFields.get(0x44+slot*4),rank=ownedFields.get(0x5c+slot*4);
    assert.notEqual(baseId,undefined);assert.notEqual(rank,undefined);
    const currentSkillId=baseId+Math.max(0,rank-1);
    await nativeClick(s,'[data-home-pet-view-skill="'+slot+'"]');
    await waitUntil(s,`document.querySelector('[data-pet-skill-dialog]')?.open&&document.querySelector('[data-pet-skill-dialog]').dataset.skillId==='${currentSkillId}'&&document.querySelector('[data-pet-skill-dialog] [data-source-control="txtLv"]')?.textContent==='${rank}'`);
  }
  async function closeSkill(){
    await nativeClick(s,'[data-pet-skill-close]');
    await waitUntil(s,`!document.querySelector('[data-pet-skill-dialog]')`);
  }
  await openHome();
  assert.equal(lastLearning().points,unreachedTail?200:400);evidence.initial=lastLearning();
  await openSlot(4);
  if(!unreachedTail){
  const quote4=lastLearning().quotes.find(q=>q.instanceId===instanceId&&q.slot===4);
  assert.equal(quote4.kind,'eligible');assert.equal(quote4.cost,200);assert.equal(quote4.rank,0);
  await waitUntil(s,`document.querySelector('[data-source-control="txtTechExpense"]')?.textContent==='200'&&document.querySelector('[data-pet-skill-learn]')?.matches(':enabled')`);
  evidence.frames=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const frame=await evaluate(s,`(async()=>{const d=document.querySelector('[data-pet-skill-dialog]'),rect=e=>e.getBoundingClientRect().toJSON(),glyph=e=>{const r=document.createRange();r.selectNodeContents(e);return [...r.getClientRects()].map(x=>x.toJSON());},cost=d.querySelector('[data-source-control="txtTechExpense"]'),next=d.querySelector('[data-source-control="edtNextSkillDesc"]'),points=document.querySelector('[data-home-pet-skill-points]'),catalog=await(await fetch('/combat-catalog.json')).json();return {cost:cost.textContent,costBounds:rect(cost),costGlyph:glyph(cost),next:next.textContent,nextBounds:rect(next),nextExpected:catalog.skills.find(x=>x.skillId===${quote4.nextSkillId})?.info,points:points.textContent,pointsBounds:rect(points),pointsGlyph:glyph(points),rank:d.querySelector('[data-source-control="txtLv"]').textContent,learnDisabled:d.querySelector('[data-pet-skill-learn]').disabled};})()`);
    assert.equal(frame.cost,'200');assert.equal(frame.points,'400');assert.equal(frame.rank,'0');assert.equal(frame.next,frame.nextExpected);assert(!frame.learnDisabled);
    for(const bounds of [...frame.costGlyph,...frame.pointsGlyph,frame.nextBounds])assert(bounds.left>=-.5&&bounds.top>=-.5&&bounds.right<=width+.5&&bounds.bottom<=height+.5);
    for(const bounds of frame.costGlyph)assert(bounds.left>=frame.costBounds.left-.5&&bounds.right<=frame.costBounds.right+.5&&bounds.top>=frame.costBounds.top-.5&&bounds.bottom<=frame.costBounds.bottom+.5);
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-learning.png';await writeFile(path,Buffer.from(shot.data,'base64'));
    evidence.frames.push({viewport:[width,height],...frame,path});
    await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
  }
  evidence.actions=[];
  async function learn(slot,cost,rank,points){
    const quote=lastLearning().quotes.find(q=>q.instanceId===instanceId&&q.slot===slot);assert.equal(quote.cost,cost);assert.equal(quote.kind,'eligible');
    await nativeClick(s,'[data-pet-skill-learn]');
    await waitUntil(s,`document.querySelector('[data-pet-skill-status]')?.textContent==='技能学习已确认'&&!document.querySelector('[data-pet-skill-dialog]').matches('[aria-busy="true"]')&&document.querySelector('[data-home-pet-skill-points]')?.textContent==='${points}'&&document.querySelector('[data-pet-skill-dialog] [data-source-control="txtLv"]')?.textContent==='${rank}'`);
    const result=lastLearning();assert.deepEqual(result.learned,{instanceId,slot,skillId:quote.nextSkillId,rank,cost});assert.equal(result.points,points);
    assert.equal(new Map(result.owned.base.find(r=>new Map(r.fields).get(0)===instanceId).fields).get(0x5c+slot*4),rank);
    evidence.actions.push(result);
  }
  if(!unreachedTail)await learn(4,200,1,200);
  const postSlot4=lastLearning();
  assert.equal(postSlot4.points,200);
  assert.equal(new Map(postSlot4.owned.base.find(r=>new Map(r.fields).get(0)===instanceId).fields).get(0x6c),1);
  const capQuote=postSlot4.quotes.find(q=>q.instanceId===instanceId&&q.slot===4);
  assert(!capQuote||capQuote.kind==='rankLimit');
  assert(await evaluate(s,`document.querySelector('[data-pet-skill-learn]').disabled`));evidence.slot4CapDisabled=true;
  await closeSkill();await openSlot(0);
  await learn(0,10,1,190);
  await waitUntil(s,`document.querySelector('[data-source-control="txtTechExpense"]')?.textContent==='20'&&document.querySelector('[data-pet-skill-learn]')?.matches(':enabled')`);
  await learn(0,20,2,170);evidence.confirmed=lastLearning();
  await closeSkill();
  await nativeClick(s,'[data-roles-close]');
  await waitUntil(s,`!document.querySelector('#home-roles[open]')&&document.activeElement.matches('[data-room-card-home]')`);evidence.strictClose=true;
  await openHome();assert.equal(lastLearning().points,170);
  const restored=lastLearning().owned.base.find(r=>new Map(r.fields).get(0)===instanceId),restoredFields=new Map(restored.fields);
  assert.equal(restoredFields.get(0x6c),1);assert.equal(restoredFields.get(0x5c),2);evidence.closeReopen={points:170,record:restored};
  await nativeClick(s,'[data-roles-close]');
  await waitUntil(s,`!document.querySelector('#home-roles[open]')&&document.activeElement.matches('[data-room-card-home]')`);evidence.reopenStrictClose=true;
  const learningWrites=network.filter(n=>n.direction==='sent'&&n.name==='PetSkillLearning'&&n.payload.operation==='LEARN');assert.equal(learningWrites.length,unreachedTail?2:3);assert.equal(new Set(learningWrites.map(n=>n.payload.requestId)).size,unreachedTail?2:3);
  if(unreachedTail)assert(!network.some(n=>n.direction==='sent'&&(n.name==='PetShop'&&n.payload.operation==='BUY'||n.name==='PetSkillLearning'&&n.payload.operation==='LEARN'&&n.payload.slot===4)));
  assert(!network.some(n=>n.direction==='sent'&&['SelectRole','CreateRoom','JoinRoom','Equipment'].includes(n.name)));evidence.noRoleSelectionOrGameplay=true;
  evidence.status=unreachedTail?'PASS_FINITE_PET_LEARNING_UNREACHED_TAIL_TWO_ACTIONS_CAP_DISABLED_CLOSE_REOPEN_SCOPE':'PASS_FINITE_PET_LEARNING_QUOTE_THREE_ACTIONS_CONFIRMED_POINTS_RANK_CLOSE_REOPEN_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.network=network;
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,token:fixture.token,source:checkpoint,pointsFixtureNotEarned:true})+'\n',{mode:0o600});}catch(error){evidence.checkpointError=String(error);}
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
