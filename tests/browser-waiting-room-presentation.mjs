import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3284', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-waiting-room-'));
let server, chrome, vite, ws;
let serverLog = '';
let holdResponses=false;const held=[];function releaseResponses(){holdResponses=false;for(const send of held.splice(0))send();}
const pages = [], network = [], fetchRequests = [];
let sequence = 0, acceptanceSession;
const statesOnly=process.argv.includes('--states-only');
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-03-R-PRESENTATION actual open waiting dialog hides Web utility/match chrome; semantic normal status clipped; pending/error/source notice remain visible; two ordinary pages, Ready/Cancel/Team/pending/refusal and Esc/reopen/Leave.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function stop(process) {
  if (process?.exitCode === null && process.signalCode === null) {
    const ended = new Promise(resolve => process.once('exit', resolve));
    process.kill();
    await ended;
  }
}

const modal = 'dialog[data-waiting-room]';
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const world = session => evaluate(session, worldExpression);
async function select(session, selector, value) {
  const index = await evaluate(session, `[...document.querySelector(${JSON.stringify(selector)}).options].filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0);
  await click(session, selector);await press(session,'Home','Home');
  for(let step=0;step<index;step++)await press(session,'ArrowDown','ArrowDown');
  await press(session,'Enter','Enter');
  assert.equal(await evaluate(session,`document.querySelector(${JSON.stringify(selector)}).value`),String(value));
}
async function input(session, selector, value) {
  await click(session,selector);
  await key(session,'a','KeyA','keyDown',{modifiers:2});await key(session,'a','KeyA','keyUp',{modifiers:2});
  await command('Input.insertText',{text:String(value)},session);
}
async function open(session) {
  await click(session,'[data-open-waiting-room]');
  await waitUntil(session,`document.querySelector('${modal}')?.open&&document.querySelector('[data-waiting-source-player]')`);
}
async function keyboardActivate(session, selector) {
  await command('Page.bringToFront',{},session);
  for(let step=0;step<40;step++) {
    if(await evaluate(session,`document.activeElement?.matches(${JSON.stringify(selector)})`)) {await press(session,'Enter','Enter');return;}
    await press(session,'Tab','Tab');
  }
  throw new Error('Keyboard could not reach '+selector);
}
async function roster(session) {
  return evaluate(session,`[...document.querySelectorAll('${modal} [data-waiting-source-player]')].map(e=>({id:e.dataset.waitingSourcePlayer,team:Number(e.dataset.team),name:document.querySelector('${modal} [data-source-control="txtPlayerName'+e.dataset.sourceControl.slice(11)+'"]')?.textContent,ready:e.dataset.waitingPlayerReady,text:e.getAttribute('aria-label'),readyIconHidden:document.querySelector('${modal} [data-source-control="picReady'+e.dataset.sourceControl.slice(11)+'"]')?.hidden}))`);
}
async function verifyRoster(sessions) {
  const states=[];
  for(const session of sessions) {
    const snapshot=await world(session), rows=await roster(session);
    assert.equal(rows.length,snapshot.players.length);
    for(const player of snapshot.players) {
      const row=rows.find(row=>row.id===player.id);assert(row,'source card for '+player.id);
      assert.equal(row.team,player.team);assert.equal(row.name,player.name);
      assert.equal(row.ready,String(snapshot.match.readyPlayerIds.includes(player.id)));
      assert(row.text.includes(player.name));assert.equal(row.readyIconHidden,!snapshot.match.readyPlayerIds.includes(player.id));
    }
    states.push({session,snapshot,rows});
  }
  evidence.checks.push({name:'Both source rosters match authoritative names, teams and ready IDs',states});
}
async function presentation(session, label, state, open = true, requireCpu = false) {
  acceptanceSession=session;
  const result=await evaluate(session,`(()=>{const d=document.querySelector('${modal}'),m=document.querySelector('.battle-match'),s=document.querySelector('[data-waiting-room-status]'),controls=document.querySelector('.controls'),notice=document.querySelector('[data-source-notice]');const cs=getComputedStyle(s),ms=getComputedStyle(m);return {open:d.open,controls:getComputedStyle(controls).visibility,match:{background:ms.backgroundColor,border:ms.borderTopColor,children:[...m.children].filter(e=>!e.matches('[data-waiting-room],[data-source-notice]')).map(e=>({tag:e.tagName,visibility:getComputedStyle(e).visibility}))},status:{state:s.dataset.waitingRoomStatusState,role:s.getAttribute('role'),text:s.textContent,clip:cs.clipPath,width:cs.width,height:cs.height,visibility:cs.visibility,padding:cs.padding,background:cs.backgroundColor},notice:notice?.open?{visibility:getComputedStyle(notice).visibility,hit:(()=>{const e=notice.querySelector('[data-source-control="btnOK"]'),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e})()}:null,cpu:[...document.querySelectorAll('[data-add-cpu]')].map(e=>({disabled:e.disabled,visibility:getComputedStyle(e).visibility}))};})()`);
  assert.equal(result.open,open);
  assert.equal(result.controls,open?'hidden':'visible');
  assert(result.match.children.length>0);
  assert(result.match.children.every(e=>e.visibility===(open?'hidden':'visible')));
  if(open){assert.equal(result.match.background,'rgba(0, 0, 0, 0)');assert.equal(result.match.border,'rgba(0, 0, 0, 0)');assert.equal(result.status.state,state);assert.equal(result.status.role,'status');assert(result.status.text.length>0);assert.equal(result.status.visibility,'visible');if(state==='normal'){assert.equal(result.status.clip,'inset(50%)');assert.equal(result.status.width,'1px');assert.equal(result.status.height,'1px');assert.equal(result.status.padding,'0px');}else{assert.equal(result.status.clip,'none');assert(parseFloat(result.status.width)>1);}if(result.notice){assert.equal(result.notice.visibility,'visible');assert(result.notice.hit);}}
  else if(requireCpu){assert(result.cpu.length>0&&result.cpu.some(e=>!e.disabled&&e.visibility==='visible'),'host CPU tool visible and enabled after Esc');}
  evidence.checks.push({name:'presentation '+label,result});
}
async function toggleReady(session,sessions,expected,keyboard=false) {
  const before=await world(session),from=network.length;
  if(keyboard)await keyboardActivate(session,'[data-waiting-ready]');else await click(session,'[data-waiting-ready]');
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).match.readyPlayerIds.includes(${JSON.stringify(before.playerId)})===${expected}`);
  await waitUntil(session,`!document.querySelector('[data-waiting-ready]').disabled&&document.activeElement?.matches('[data-waiting-ready]')`);
  assert(await evaluate(session,`document.activeElement?.matches('[data-waiting-ready]')`),'Ready keeps native focus');
  const rows=network.slice(from).filter(row=>row.page===session&&row.name==='Ready');
  assert.equal(rows.filter(row=>row.direction==='sent').length,1);assert(rows.some(row=>row.direction==='received'&&row.success));
  assert(await evaluate(session,`document.querySelector('[data-waiting-team="0"]').disabled&&document.querySelector('[data-waiting-team="1"]').disabled`)==expected||!expected);
  evidence.checks.push({name:'Ordinary Ready '+expected+' confirmed by both snapshots',rows});await verifyRoster(sessions);
}
async function changeTeam(session,sessions,team,keyboard=false) {
  const before=await world(session);
  if(before.players.find(p=>p.id===before.playerId).team===team)return;
  const from=network.length;
  await waitUntil(session,`!document.querySelector('[data-waiting-team="${team}"]').disabled`);
  if(keyboard)await keyboardActivate(session,'[data-waiting-team="'+team+'"]');else await click(session,'[data-waiting-team="'+team+'"]');
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).players.find(p=>p.id===${JSON.stringify(before.playerId)}).team===${team}`);
  await waitUntil(session,`document.querySelector('[data-waiting-team="${team}"]').disabled&&!document.querySelector('[data-waiting-team="${1-team}"]').disabled`);
  assert(await evaluate(session,`document.activeElement?.matches('[data-waiting-ready]')`),'confirmed disabled team selection moves native focus to Ready');
  const rows=network.slice(from).filter(row=>row.page===session&&row.name==='ChangeTeam');
  assert.equal(rows.filter(row=>row.direction==='sent').length,1);assert(rows.some(row=>row.direction==='received'&&row.success));
  evidence.checks.push({name:'Ordinary team '+team+' confirmed by both snapshots with current team disabled',rows});await verifyRoster(sessions);
}
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
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(session, `Boolean(${expression})`)) return;
      if (await evaluate(session, `document.querySelector('#battle-status')?.value.includes('Internal Server Error')`)) throw new Error('Browser received Internal Server Error');
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') && !String(error).includes('Inspected target navigated')) throw error;
    }
    await pause(100);
  }
  throw new Error('Browser condition timeout: ' + expression + '\n' + await evaluate(session, `document.querySelector('#battle-status')?.value`));
}
async function click(session, selector) {
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point}, session);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point}, session);
}
function parseClientInput(bytes) {
  const envelope = TransportDataUtil.tsbuffer.decode(bytes, 'ServerInputData');
  assert(envelope.isSucc, envelope.errMsg);
  const service = decoder.serviceMap.id2Service[envelope.value.serviceId];
  const payload = decoder.tsbuffer.decode(envelope.value.buffer, service.type === 'api' ? service.reqSchemaId : service.msgSchemaId);
  assert(payload.isSucc, payload.errMsg);
  return {isSucc: true, result: {type: service.type, service, ...(service.type === 'api' ? {req: payload.value} : {msg: payload.value})}};
}
async function key(session, key, code, type = 'keyDown', options = {}) {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), ...options, windowsVirtualKeyCode: (/^F(?:[5-9]|1[0-2])$/.test(code) ? 111 + Number(code.slice(1)) : ({Tab: 9, Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0))}, session);
}
async function press(session, value, code) {
  await key(session, value, code);
  await key(session, value, code, 'keyUp');
}
async function screenshot(session, name) {
  await writeFile(`${output}-partial.json`,JSON.stringify(evidence,null,2)+'\n');
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = 'recovery/output/browser-waiting-room-presentation-'+new Date().toISOString().replace(/[:.]/g,'-');
await mkdir('recovery/output', {recursive: true});
async function ready(session) {
  await waitUntil(session, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#create-room').disabled&&document.querySelector('#room-min-players')`);
}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5314'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3284', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.slice(from).includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.slice(from).includes('Server started'), serverLog);
}
async function launchBrowser() {
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9514', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9514/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('close', () => {for (const callback of pending.values()) callback.reject(new Error('CDP closed')); pending.clear();});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    if(message.method==='Fetch.requestPaused'){fetchRequests.push({session:message.sessionId,...message.params});return;}
    const callback = pending.get(message.id);
    if (callback) {pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);}
    if (!['Network.webSocketFrameReceived', 'Network.webSocketFrameSent'].includes(message.method)) return;
    const frame = message.params.response;
    if (frame.opcode !== 2) return;
    const bytes = new Uint8Array(Buffer.from(frame.payloadData, 'base64'));
    if (bytes.length === 1 && bytes[0] === 0) return;
    const received = message.method.endsWith('Received');
    const parsed = received ? TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes) : parseClientInput(bytes);
    assert(parsed.isSucc, parsed.errMsg);
    const result = parsed.result;
    if (['CreateRoom', 'Join', 'Ready', 'ChangeTeam', 'Leave', 'PlayerInput', 'RoomChat', 'RoomSnapshot','RoomInvite'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5314,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3284',ws:true,rewrite:()=> '/',configure:proxy=>{proxy.on('proxyReqWs',(_request,_incoming,socket)=>{const originalWrite=socket.write.bind(socket);let frames=Buffer.alloc(0);
      socket.write=(data,...args)=>{
        const chunk=Buffer.isBuffer(data)?data:Buffer.from(data);
        if(chunk.subarray(0,4).toString()==='HTTP')return originalWrite(data,...args);
        frames=Buffer.concat([frames,chunk]);
        while(frames.length>=2){
          let size=frames[1]&127,header=2;
          if(size===126){if(frames.length<4)break;size=frames.readUInt16BE(2);header=4;}
          else if(size===127){if(frames.length<10)break;size=Number(frames.readBigUInt64BE(2));header=10;}
          if(frames.length<header+size)break;
          const frame=Buffer.from(frames.subarray(0,header+size));frames=frames.subarray(header+size);
          const heartbeat=(frame[0]&15)===2&&size===1&&frame[header]===0;
          if(holdResponses&&!heartbeat&&(frame[0]&15)<8)held.push(()=>originalWrite(frame));else originalWrite(frame);
        }
        const callback=args.find(arg=>typeof arg==='function');callback?.();return true;
      };});}}}}});
  await vite.listen();await launchBrowser();
  const sessions=[];
  for(const name of ['等待甲','等待乙']) {
    const {browserContextId}=await command('Target.createBrowserContext');
    const page=await newPage(browserContextId);sessions.push(page);await input(page,'#player-name',name);
  }
  const [a,b]=sessions;
  await click(a,'#create-room-controls > summary');await input(a,'#room-name','等待面板验收');
  await select(a,'#room-mode',1);await select(a,'#room-map',7);await input(a,'#room-min-players',2);
  await click(a,'#create-room');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const initial=await world(a);
  await click(b,'#refresh-rooms');await waitUntil(b,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(initial.roomId)}&&!o.disabled)`);
  await select(b,'#room',initial.roomId);await click(b,'#join');
  for(const page of sessions)await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).players.length===2`);
  assert((await world(a)).players.every(player=>!player.isCpu));
  if(!statesOnly){
  await command('Fetch.enable',{patterns:[{urlPattern:'*/ui.json',requestStage:'Request'}]},a);
  await click(a,'[data-open-waiting-room]');await waitUntil(a,`document.querySelector('${modal}')?.open&&document.querySelector('[data-waiting-room-status]')?.dataset.waitingRoomStatusState==='loading'`);
  await presentation(a,'loading real delayed ui.json','loading');await screenshot(a,'1080p-loading');
  while(!fetchRequests.some(r=>r.session===a))await pause(20);
  await command('Fetch.continueRequest',{requestId:fetchRequests.find(r=>r.session===a).requestId},a);await command('Fetch.disable',{},a);
  await waitUntil(a,`document.querySelector('[data-waiting-source-player]')`);
  await command('Fetch.enable',{patterns:[{urlPattern:'*/ui.json',requestStage:'Request'}]},b);await click(b,'[data-open-waiting-room]');
  while(!fetchRequests.some(r=>r.session===b))await pause(20);
  await command('Fetch.failRequest',{requestId:fetchRequests.find(r=>r.session===b).requestId,errorReason:'Failed'},b);await command('Fetch.disable',{},b);
  await waitUntil(b,`document.querySelector('[data-waiting-room-status]')?.dataset.waitingRoomStatusState==='error'`);await presentation(b,'real ui.json load failure','error');await screenshot(b,'1080p-load-error');
  await press(b,'Escape','Escape');await waitUntil(b,`!document.querySelector('${modal}').open`);await presentation(b,'load failure Esc restores controls',null,false);await open(b);await presentation(b,'load failure reopen retries actual source','normal');
  }else for(const page of sessions)await open(page);
  evidence.reusedSourceStateEvidence='browser-waiting-room-button.json: exact source hover/pressed/captured/selected/disabled layer matrix, unchanged source-button consumer';
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    acceptanceSession=a;await command('Page.bringToFront',{},a);
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);
    const expectedScale=Math.max(.25,Math.min((width-64)/615,(height-180)/391,2)),expectedDpi=height===600?103:192;
    await waitUntil(a,`(()=>{const stage=document.querySelector('[data-waiting-room-stage]'),glyphs=[...document.querySelectorAll('[data-source-raster-glyph]')];return innerWidth===${width}&&innerHeight===${height}&&stage&&Math.abs(stage.getBoundingClientRect().width/615-${expectedScale})<.0001&&glyphs.length>0&&glyphs.every(g=>getComputedStyle(g).backgroundImage.includes('SIMSUN-mono-${expectedDpi}.png'));})()`);
    const before=await world(a);
    if(width===800){await presentation(a,label+' normal unprepared/selected team','normal');await screenshot(a,label+'-normal-selected-team');}
    holdResponses=true;await click(a,'[data-waiting-ready]');await waitUntil(a,`document.querySelector('[data-waiting-room-status]').dataset.waitingRoomStatusState==='pending'`);
    await presentation(a,label+' pending ready','pending');assert(!(await world(a)).match.readyPlayerIds.includes(before.playerId),'held response does not optimistically ready');await screenshot(a,label+'-pending-ready');releaseResponses();
    for(const page of sessions)await waitUntil(page,`(${worldExpression}).match.readyPlayerIds.includes(${JSON.stringify(before.playerId)})`);
    await waitUntil(a,`!document.querySelector('[data-waiting-ready]').disabled`);await presentation(a,label+' prepared/cancel normal','normal');await screenshot(a,label+'-cancel-ready');
    await toggleReady(a,sessions,false);await presentation(a,label+' cancelled normal','normal');
    if(width===800){const team=(await world(a)).players.find(p=>p.id===before.playerId).team;await changeTeam(a,sessions,1-team,true);await presentation(a,label+' team confirmed normal','normal');}
    const inviteFrom=network.length;holdResponses=true;await click(a,'[data-waiting-invite]');await waitUntil(a,`document.querySelector('[data-waiting-invite]').disabled`);await presentation(a,label+' pending invite','pending');releaseResponses();
    await waitUntil(a,`document.querySelector('[data-source-notice]')?.open`);await presentation(a,label+' INVITE_EMPTY notice visible/hittable','error');await screenshot(a,label+'-invite-rejected-notice');
    const rejection=network.slice(inviteFrom).find(r=>r.page===a&&r.name==='RoomInvite'&&r.direction==='received');assert.equal(rejection?.success,false);assert.equal(rejection.response.code,'INVITE_EMPTY');
    await click(a,'[data-source-notice] [data-source-control="btnOK"]');await waitUntil(a,`!document.querySelector('[data-waiting-invite]').disabled&&document.activeElement?.matches('[data-waiting-ready]:enabled,[data-waiting-invite]:enabled')`);await presentation(a,label+' error/focus after notice closes','error');
    await press(a,'Escape','Escape');await waitUntil(a,`!document.querySelector('${modal}').open`);assert.equal((await world(a)).phase,'WAITING');await presentation(a,label+' Esc restores utility/CPU visibility',null,false,true);await screenshot(a,label+'-closed');await open(a);await presentation(a,label+' reopen','error');
    await writeFile(`${output}-partial.json`,JSON.stringify(evidence,null,2)+'\n');
  }
  await click(a,'[data-waiting-close]');await waitUntil(a,`(${worldExpression})===null&&!document.querySelector('${modal}')`);await screenshot(a,'4k-left');await click(b,'[data-waiting-close]');await waitUntil(b,`(${worldExpression})===null&&!document.querySelector('${modal}')`);evidence.checks.push({name:'two ordinary source Close Leave actions clear both world/dialog/button consumers'});
  evidence.status='PASS';console.log('PASS: waiting presentation, real pending/refusal/focus, Esc utility/CPU restore, reopen and Leave; '+output);
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);
  const session=acceptanceSession??pages[0]?.sessionId;if(session){evidence.failureWorld=await world(session).catch(()=>null);evidence.failureFocus=await evaluate(session,`document.activeElement?.outerHTML`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  releaseResponses();
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3284,vite:5314,chrome:9514};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
