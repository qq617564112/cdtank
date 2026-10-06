import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3283', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-waiting-room-'));
let server, chrome, vite, ws;
let serverLog = '';
let holdResponses=false;const held=[];function releaseResponses(){holdResponses=false;for(const send of held.splice(0))send();}
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-03-R-DESC-GLYPHS 450 finite original mono glyphs, every formal description covered; map7/map21 full-known native spacing/ink at three current DPI faces and explicit unknown input fallback: ordinary original maps at real 800/1080p/4K and explicit long props reformat/scroll/text-change.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function stop(process) {
  if (process?.exitCode === null && process.signalCode === null) {
    const ended = new Promise(resolve => process.once('exit', resolve));
    process.kill();
    await ended;
  }
}

const mixedOnly=process.argv.includes('--mixed-only');
const fixtureOnly=process.argv.includes('--fixture-only')||mixedOnly;
const resume = process.argv.includes('--resume')||fixtureOnly;
if(fixtureOnly)evidence.scope='M5-03-R-DESC-GLYPHS isolated production-component long-description props reading/scrollbar at real 800/1080p/4K; no gameplay state injection.';
evidence.resumedEvidence = resume ? 'browser-waiting-room-description-glyphs-2026-10-03T21-31-41-492Z.json' : null;
const modal = 'dialog[data-waiting-room]';
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const world = session => evaluate(session, worldExpression);
async function select(session, selector, value) {
  const index = await evaluate(session, `[...document.querySelector(${JSON.stringify(selector)}).options].filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0);
  await click(session, selector);await press(session,'Home','Home');
  for(let step=0;step<index;step++)await press(session,'ArrowDown','ArrowDown');
  await press(session,'Enter','Enter');
  await waitUntil(session,`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(String(value))}`);
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
async function verifySource(session,width,height) {
  const source=await evaluate(session,`(async()=>{
    const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path==='ui/layouts/room_main.xml');
    const d=document.querySelector('${modal}'),stage=d.querySelector('[data-waiting-room-stage]');
    function rectangle(w){const n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);let left=n[0],top=n[1];for(let parent=w.parent;parent;){const owner=layout.windows.find(w=>w.name===parent),r=owner.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);left+=r[0];top+=r[1];parent=owner.parent;}return {left,top,width:n[2]-n[0],height:n[3]-n[1]};}
    function asset(ref){const m=/^set:(\\S+) image:(.+)$/.exec(ref);const sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;}
    const rows=[...stage.querySelectorAll('[data-source-control]')].map(e=>{const name=e.dataset.sourceControl,w=layout.windows.find(w=>w.name===name);if(!w)return null;const r=e.getBoundingClientRect();return {name,parent:w.parent,expected:rectangle(w),native:{left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height)},asset:e.dataset.sourceAsset,reference:w.properties.Image,buttonReferences:['NormalImage','HoverImage','PushedImage','DisabledImage'].map(k=>w.properties[k]).filter(Boolean),background:getComputedStyle([...e.querySelectorAll('[data-room-button-image]')].at(-1)??e).backgroundImage,hidden:e.hidden,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};}).filter(Boolean);
    const assets=[...new Set(rows.map(r=>r.asset).filter(Boolean))];
    const decoded=await Promise.all(assets.map(path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve({asset:path,width:i.naturalWidth,height:i.naturalHeight});i.onerror=()=>reject(new Error(path));i.src='/'+path;})));
    for(const row of rows){if(row.reference)row.expectedAsset=asset(row.reference);row.expectedButtonAssets=row.buttonReferences.map(asset);}
    const snapshot=JSON.parse(document.querySelector('#battle-status').dataset.world);const tanks=[...stage.querySelectorAll('[data-waiting-source-player]')].map(panel=>{const player=snapshot.players.find(p=>p.id===panel.dataset.waitingSourcePlayer),name='picPlayerTank'+panel.dataset.sourceControl.slice(11),node=stage.querySelector('[data-source-control="'+name+'"]'),reference='set:tanke0 image:'+['data','ui','tanke',String(player.tankId).padStart(3,'0')+'.tga'].join(String.fromCharCode(92));return {playerId:player.id,tankId:player.tankId,asset:node.dataset.sourceAsset,expectedAsset:asset(reference)};});return {rows,decoded,tanks};
  })()`);
  for(let index=0;index<12;index++)assert(source.rows.some(row=>row.name==='PlayerPanel'+index),'all 12 source slots');
  for(const row of source.rows) {
    assert.deepEqual(row.native,row.expected,row.name+' source rectangle');
    if(row.expectedAsset&&row.asset)assert.equal(row.asset,row.expectedAsset,row.name+' exact fixed image');
    if(row.expectedButtonAssets.length&&row.asset)assert(row.expectedButtonAssets.includes(row.asset),row.name+' exact button image');
    if(row.asset)assert(row.background.includes('/'+row.asset),row.name+' source background');
    
  }
  for(const tank of source.tanks){assert.equal(tank.asset,tank.expectedAsset,'recovered tank icon '+tank.tankId);const png=source.decoded.find(row=>row.asset===tank.asset);assert.equal(png.width,32);assert.equal(png.height,32);}
  assert(source.decoded.length>0&&source.decoded.every(row=>row.width>0&&row.height>0));
  evidence.checks.push({name:'room_main rectangles, exact raw fixed images and decoded PNG at '+width+'x'+height,source});
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
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),clip=e.closest('[data-waiting-description]')?.getBoundingClientRect();return {x:e.matches('[data-source-description-arrow]')?clip.right-3:r.x+r.width/2,y:r.y+r.height/2}})()`);
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
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = 'recovery/output/browser-waiting-room-description-glyphs-'+new Date().toISOString().replace(/[:.]/g,'-');
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5313'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3283', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9513', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9513/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('close', () => {for (const callback of pending.values()) callback.reject(new Error('CDP closed')); pending.clear();});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
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
const fixtureCode = `import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/interface/lobby/waiting-room.css';import {SourceMultilineReading} from '/src/interface/resources/source-multiline-reading';import {SourceImageScale} from '/src/interface/resources/source-static-image';import {HomeSourceLayout} from '/src/interface/resources/source-ui-layout';import {loadSourceUiFonts} from '/src/interface/resources/source-ui-fonts';await loadSourceUiFonts();const ui=await(await fetch('/ui.json')).json();const layout=new HomeSourceLayout(ui,'room_main.xml');function Fixture(){const [open,setOpen]=useState(true),[short,setShort]=useState(false),[scale,setScale]=useState(Math.max(.25,Math.min((innerWidth-64)/615,(innerHeight-180)/391,2)));useEffect(()=>{const resize=()=>setScale(Math.max(.25,Math.min((innerWidth-64)/615,(innerHeight-180)/391,2)));addEventListener('resize',resize);return()=>removeEventListener('resize',resize)},[]);return <><button data-description-fixture-close onClick={()=>setOpen(false)}>关闭说明夹具</button><button data-description-fixture-change onClick={()=>setShort(true)}>切换说明</button>{open&&<div className='waiting-room-stage' style={{left:20,top:40,transform:'scale('+scale+')'}}><SourceImageScale value={scale}><SourceMultilineReading ui={ui} layout={layout} name='edtMapDesc' suffix='room_main.xml' text={short?'短说明':location.search.includes('mixed=1')?('ASCII words and spaces\\t中文段落\\r继续阅读\\n空白下一段\\n\\n').repeat(8):('中文地图说明🙂阅读长文本，普通字符逐行展示，键盘滚轮箭头和透明滚动位置可以阅读全文。\\n').repeat(8)}/></SourceImageScale></div>}</>};createRoot(document.getElementById('fixture')).render(<Fixture/>);`;
try {
  await launchServer();
  vite=await createServer({configFile:false,plugins:[{name:'description-reading-fixture',resolveId(id){if(id==='/__description-fixture.tsx')return id;},load(id){if(id==='/__description-fixture.tsx')return fixtureCode;},configureServer(server){server.middlewares.use('/__description-fixture',(req,res,next)=>{if(!['/',''].includes(req.url.split('?')[0]))return next();res.setHeader('Content-Type','text/html');res.end('<html><body style="background:#263b49"><div id="fixture"></div><script type="module" src="/__description-fixture.tsx"></script></body></html>');});}}],root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5313,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3283',ws:true,rewrite:()=> '/',configure:proxy=>{proxy.on('proxyReqWs',(_request,_incoming,socket)=>{const originalWrite=socket.write.bind(socket);let frames=Buffer.alloc(0);
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
  for(const name of ['换行甲']) {
    const {browserContextId}=await command('Target.createBrowserContext');
    const page=await newPage(browserContextId);sessions.push(page);await input(page,'#player-name',name);
  }
  const [a]=sessions;
  if(!resume){
  await click(a,'#create-room-controls > summary');await input(a,'#room-name','地图说明🙂验收');
  await select(a,'#room-mode',1);await select(a,'#room-map',7);await input(a,'#room-min-players',2);
  await click(a,'#create-room');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const initial=await world(a);
  for(const page of sessions)await open(page);
  }
  const native=JSON.parse(await readFile('recovery/output/waiting-room-description-draw-native.json','utf8'));assert.equal(native.status,'PASS');
  async function reading(page,label,fixture=false){
    const state=await evaluate(page,`(async()=>{
      const e=document.querySelector('[data-waiting-description]'),lib=await(await fetch('/ui-font-raster.json')).json(),scale=Number(e.dataset.sourceDescriptionScale),face=lib.faces.find(f=>f.dpi===Number(e.dataset.sourceDescriptionDpi)),lines=[...e.querySelectorAll('[data-source-description-line]')],layer=e.querySelector('[data-source-description-lines]'),bar=e.querySelector('[data-source-description-scrollbar]');
      const canvas=document.createElement('canvas').getContext('2d');canvas.font='12px CDTank-SIMSUN';
      return {scale,dpi:face.dpi,spacing:Number(e.dataset.sourceDescriptionLineSpacing),nativeSpacing:face.lineSpacing,baseline:face.baseline,source:face.glyphs,atlas:face.atlas,text:lines.map(l=>l.textContent).join(''),position:Number(e.dataset.sourceDescriptionPosition),document:Number(e.dataset.sourceDescriptionDocument),page:Number(e.dataset.sourceDescriptionPage),visible:!bar.hidden,rootClip:getComputedStyle(e).overflow,layerClip:getComputedStyle(layer).overflow,layerHeight:parseFloat(layer.style.height),rows:lines.map(l=>({text:l.textContent,start:Number(l.dataset.sourceLineStart),length:Number(l.dataset.sourceLineLength),top:parseFloat(l.style.top),height:parseFloat(l.style.height),colour:getComputedStyle(l).color,characters:[...l.textContent].map(c=>({c,advance:canvas.measureText(c).width})),glyphs:[...l.querySelectorAll('[data-source-description-glyph]')].map(g=>({code:Number(g.dataset.sourceDescriptionGlyph),left:parseFloat(g.style.left),top:parseFloat(g.style.top),width:parseFloat(g.style.width),height:parseFloat(g.style.height),background:getComputedStyle(g).backgroundImage})),fallback:[...l.querySelectorAll('[data-source-description-fallback]')].map(g=>({character:g.dataset.sourceDescriptionFallback,left:parseFloat(g.style.left),content:getComputedStyle(g,'::before').content}))}))};})()`);
    assert(Math.abs(state.spacing-state.nativeSpacing/state.scale)<.001);assert(Math.abs(state.document-state.rows.length*state.spacing)<.001);assert.equal(state.visible,state.document>state.page);assert.equal(state.rootClip,'visible');assert.equal(state.layerClip,'hidden');assert(Math.abs(state.layerHeight-state.page-5/state.scale)<.001);
    let known=0,unknown=0;
    for(const [index,row] of state.rows.entries()){
      assert(Math.abs(row.top-(index*state.spacing-state.position))<.001);assert(Math.abs(row.height-state.spacing)<.001);assert.equal(row.colour,'rgb(255, 255, 255)');assert.equal(row.length,Array.from(row.text).length);let advance=0,gi=0,fi=0;
      for(const {c,advance:provider} of row.characters){if(c==='\n'||c==='\r')continue;const original=state.source.find(g=>g.codepoint===c.codePointAt(0));if(original){const g=row.glyphs[gi++];assert.equal(g.code,original.codepoint);assert(Math.abs(g.left-advance-original.inkX/state.scale)<.001);assert(Math.abs(g.top-(state.baseline+original.inkY)/state.scale)<.001);assert(Math.abs(g.width-original.width/state.scale)<.001);assert(Math.abs(g.height-original.height/state.scale)<.001);assert(g.background.includes(state.atlas.asset));known++;}else{const f=row.fallback[fi++];assert.equal(f.character,c);assert(Math.abs(f.left-advance)<.001);assert(f.content.length>0);unknown++;}advance=Math.fround(advance+(original?original.advance/state.scale:provider));}
    }
    assert(known>0);state.knownGlyphs=known;state.unknownGlyphs=unknown;if(!fixture){assert.equal(unknown,0,'every formal map description glyph uses original raster');assert.equal(known,Array.from(state.text).length);}
    if(!fixture){const wire=network.filter(r=>r.page===page&&r.direction==='received'&&r.name==='RoomSnapshot').at(-1).payload;assert.equal(state.text,wire.roomInfo.mapDescription);assert.equal(state.position,0);}
    evidence.checks.push({name:(fixture?'isolated long props':'ordinary authoritative map')+' original normal draw/glyph/fallback/line spacing '+label,state});return state;
  }
  async function currentFace(page,width,height){
    const scale=Math.max(.25,Math.min((width-64)/615,(height-180)/391,2)),dpi=height===600?103:192;
    await waitUntil(page,`innerWidth===${width}&&innerHeight===${height}&&Math.abs(Number(document.querySelector('[data-waiting-description]')?.dataset.sourceDescriptionScale)-${scale})<.0001&&Number(document.querySelector('[data-waiting-description]')?.dataset.sourceDescriptionDpi)===${dpi}&&[...document.querySelectorAll('[data-source-description-glyph]')].length>0&&[...document.querySelectorAll('[data-source-description-glyph]')].every(g=>getComputedStyle(g).backgroundImage.includes('SIMSUN-mono-${dpi}.png'))`);
  }
  if(!resume){
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);await currentFace(a,width,height);await reading(a,label);const fallback=await evaluate(a,`(()=>{const e=document.querySelector('[data-source-control="txtRoomName"]');return {text:e.textContent,known:e.querySelectorAll('[data-source-raster-glyph]').length}})()`);const authoritativeTitle=network.filter(r=>r.page===a&&r.direction==='received'&&r.name==='RoomSnapshot').at(-1).payload.roomInfo.name;assert.equal(fallback.text,authoritativeTitle);assert(fallback.text.startsWith('地图说明🙂验收'));assert(fallback.text.endsWith(' · 团队模式·木桶广场'));assert.equal(fallback.known,0);evidence.checks.push({name:'ordinary unknown room name keeps readable TTF fallback '+label,fallback});await screenshot(a,label+'-ordinary-description');
  }
  await click(a,'[data-waiting-close]');await waitUntil(a,`(${worldExpression})===null&&!document.querySelector('${modal}')`);await screenshot(a,'4k-left');evidence.checks.push({name:'ordinary original map Leave clears reader before actual map change'});
  }
  if(!fixtureOnly){
  if(!await evaluate(a,`document.querySelector('#create-room-controls').open`))await click(a,'#create-room-controls > summary');await select(a,'#room-mode',5);await waitUntil(a,`[...document.querySelector('#room-map').options].some(o=>o.value==='21')`);await select(a,'#room-map',21);await input(a,'#room-name','木桶击破说明');await click(a,'#create-room');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);await open(a);
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);await currentFace(a,width,height);await reading(a,'real m005/map21 '+label);await screenshot(a,label+'-longest-map');
  }
  await click(a,'[data-waiting-close]');await waitUntil(a,`(${worldExpression})===null`);
  }
  await command('Page.navigate',{url:'http://127.0.0.1:5313/__description-fixture'+(mixedOnly?'?mixed=1':'')},a);await waitUntil(a,`document.querySelector('[data-waiting-description]')&&document.querySelector('[data-source-description-line]')`);await waitUntil(a,`document.querySelector('[data-source-description-line]')`);const fixtureFont=await evaluate(a,`({known:document.querySelectorAll('[data-source-raster-glyph]').length,face:[...document.fonts].some(f=>f.family.includes('CDTank-SIMSUN')&&f.status==='loaded')})`);assert(fixtureFont.known===0||fixtureFont.face,'fixture keeps fallback/atlas font contract');evidence.checks.push({name:'isolated font provider loaded or explicit fallback',fixtureFont});
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);await currentFace(a,width,height);
    await click(a,'[data-waiting-description]');await press(a,'Home','Home');const before=await reading(a,label,true);assert(before.visible);assert(before.unknownGlyphs>0,'explicit long props unknown input fallback remains supported');assert(before.text.includes('🙂'));await screenshot(a,label+'-long-props-top');
    if(mixedOnly){assert(before.text.includes('\t')&&before.text.includes('\r')&&before.text.includes('\n\n'));await press(a,'End','End');const end=await reading(a,label+' mixed End',true);assert.equal(end.position,end.document-end.page);await screenshot(a,label+'-mixed-end');continue;}
    const p=await evaluate(a,`(()=>{const r=document.querySelector('[data-waiting-description]').getBoundingClientRect();return{x:r.x+20,y:r.y+20}})()`);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...p,deltaX:0,deltaY:48},a);await waitUntil(a,`Number(document.querySelector('[data-waiting-description]').dataset.sourceDescriptionPosition)>0`);await reading(a,label+' wheel',true);
    await press(a,'Home','Home');await click(a,'[data-source-description-arrow="down"]');await waitUntil(a,`Number(document.querySelector('[data-waiting-description]').dataset.sourceDescriptionPosition)===Number(document.querySelector('[data-waiting-description]').dataset.sourceDescriptionLineSpacing)`);
    await press(a,'End','End');const end=await reading(a,label+' End',true);assert.equal(end.position,end.document-end.page);await press(a,'Home','Home');
    const t=await evaluate(a,`(()=>{const r=document.querySelector('[data-source-description-thumb]').getBoundingClientRect(),bar=document.querySelector('[data-source-description-scrollbar]').getBoundingClientRect();return{x:bar.right-3,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...t},a);await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:t.x,y:t.y+15*before.scale},a);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:t.x,y:t.y+15*before.scale},a);await waitUntil(a,`Number(document.querySelector('[data-waiting-description]').dataset.sourceDescriptionPosition)>0`);await reading(a,label+' dragged-transparent-source-thumb',true);await screenshot(a,label+'-long-props-dragged');
  }
  if(!mixedOnly){
  await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},a);
  await click(a,'[data-waiting-description]');await press(a,'Home','Home');
  const down='[data-source-description-arrow="down"]', up='[data-source-description-arrow="up"]';
  const point=await evaluate(a,`(()=>{const r=document.querySelector('${down}').getBoundingClientRect();return{x:r.x+4,y:r.y+r.height/2}})()`);
  const asset=()=>evaluate(a,`document.querySelector('${down}').dataset.sourceAsset`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:700,y:500},a);assert.equal(await asset(),'ui/regions/60/136.png');await screenshot(a,'800-arrow-normal');
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},a);assert.equal(await asset(),'ui/regions/60/137.png');await screenshot(a,'800-arrow-hover');
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point},a);assert.equal(await asset(),'ui/regions/60/138.png');assert(await evaluate(a,`document.querySelector('${down}').hasPointerCapture(1)`));await screenshot(a,'800-arrow-pushed');
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:700,y:500},a);assert.equal(await asset(),'ui/regions/60/137.png');
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:700,y:500},a);assert.equal(await asset(),'ui/regions/60/136.png');assert.equal(await evaluate(a,`Number(document.querySelector('[data-waiting-description]').dataset.sourceDescriptionPosition)`),0);assert(!await evaluate(a,`document.querySelector('${down}').hasPointerCapture(1)`));
  evidence.checks.push({name:'source down-arrow normal/hover/pushed assets, pointer capture, outside held hover and suppressed outside release'});
  await keyboardActivate(a,down);assert.equal(await evaluate(a,`Number(document.querySelector('[data-waiting-description]').dataset.sourceDescriptionPosition)`),Number(await evaluate(a,`document.querySelector('[data-waiting-description]').dataset.sourceDescriptionLineSpacing`)));
  await keyboardActivate(a,up);assert.equal(await evaluate(a,`Number(document.querySelector('[data-waiting-description]').dataset.sourceDescriptionPosition)`),0);
  evidence.checks.push({name:'ordinary Tab/Enter arrow activation moves one source line and clamps at start'});
  const holdThumb=async()=>{const t=await evaluate(a,`(()=>{const r=document.querySelector('[data-source-description-thumb]').getBoundingClientRect(),b=document.querySelector('[data-source-description-scrollbar]').getBoundingClientRect();return{x:b.right-3,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...t},a);assert(await evaluate(a,`document.querySelector('[data-source-description-thumb]').hasPointerCapture(1)`));};
  await holdThumb();await keyboardActivate(a,'[data-description-fixture-change]');await waitUntil(a,`document.querySelector('[data-waiting-description]').dataset.sourceDescriptionDocument===document.querySelector('[data-waiting-description]').dataset.sourceDescriptionLineSpacing`);assert(!await evaluate(a,`document.querySelector('[data-source-description-thumb]').hasPointerCapture(1)`));
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:700,y:500},a);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:700,y:500},a);assert.equal(await evaluate(a,`document.querySelector('[data-waiting-description]').dataset.sourceDescriptionPosition`),'0');assert.equal(await evaluate(a,`document.querySelector('[data-source-description-line]').textContent`),'短说明');
  evidence.checks.push({name:'held transparent-thumb capture releases on ordinary fixture text prop change and stale pointer movement leaves new short text at zero'});
  await command('Page.navigate',{url:'http://127.0.0.1:5313/__description-fixture'},a);await waitUntil(a,`document.querySelector('[data-source-description-line]')`);await holdThumb();await keyboardActivate(a,'[data-description-fixture-close]');await waitUntil(a,`!document.querySelector('[data-waiting-description]')`);evidence.checks.push({name:'long props fixture unmount removes native-reading controls/capture'});
  }else{await click(a,'[data-description-fixture-close]');await waitUntil(a,`!document.querySelector('[data-waiting-description]')`);evidence.checks.push({name:'mixed text fixture ordinary close removes formatted rows'});}
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: '+(fixtureOnly?'isolated production-component props reading/scroll':'original-map reading + explicit long props scroll fixture')+', 800/1080/4K; '+output);
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);
  const session=pages[0]?.sessionId;if(session){evidence.failureWorld=await world(session).catch(()=>null);evidence.failureFocus=await evaluate(session,`document.activeElement?.outerHTML`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  releaseResponses();
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3283,vite:5313,chrome:9513};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
