import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-source-fonts.mjs <Chromium CDP WebSocket URL>');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-fonts-'));
const database = join(directory, 'accounts.sqlite');
let server;
async function start() {
  let log='';
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],
    {env:{...process.env,PORT:'3134',ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{log+=String(data);});server.stderr.on('data',data=>{log+=String(data);});
  const deadline=Date.now()+15000;
  while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
}
async function stop() {
  if(server?.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
}
await start();
const vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',
  server:{port:5193,host:'127.0.0.1',proxy:{'/game':{target:'ws://127.0.0.1:3134',ws:true,rewrite:()=> '/'}}}});
await vite.listen();
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
const pages = [];
const contexts = [];
const state = session => evaluate(session, `JSON.parse(document.querySelector('#battle-status').dataset.world)`);
try {
  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5193',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
  await waitUntil(sessionId,`document.querySelector('#tank')?.options.length===21`);
  await command('Network.enable',{},sessionId);
  await command('Network.setBlockedURLs',{urls:['*ui/fonts/SIMSUN.ttf*']},sessionId);
  await evaluate(sessionId,`document.querySelector('#open-home').click()`);
  await waitUntil(sessionId,`document.querySelector('#home-inventory output').value && !document.querySelector('#home-inventory output').value.includes('载入物品')`);
  const failure=await evaluate(sessionId,`document.querySelector('#home-inventory output').value`);
  assert(!await evaluate(sessionId,`document.fonts.check('12px "CDTank-SIMSUN"') && Array.from(document.fonts).some(f=>f.family==='CDTank-SIMSUN')`));
  await evaluate(sessionId,`document.querySelector('[data-home-close]').click()`);
  await command('Network.setBlockedURLs',{urls:[]},sessionId);
  const token=await evaluate(sessionId,`localStorage.getItem('cdtank-account-token')`);
  assert(token);
  const store=new AccountStore(database),account=store.open(token);
  store.replaceInventory(account.accountId,[{instanceId:301,itemTableId:2001,ownedQuantity:5,battleQuantity:0,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);
  store.close();
  await evaluate(sessionId,`document.querySelector('#open-home').click()`);
  await waitUntil(sessionId,`document.querySelector('[data-inventory-instance="301"]') && Array.from(document.fonts).some(f=>f.family==='CDTank-SIMSUN'&&f.status==='loaded')`);
  const fonts=await evaluate(sessionId,`(async()=>{
    const library=await(await fetch('/ui-fonts.json')).json();
    const assets=library.fonts.flatMap(font=>font.glyphs||[]);
    await Promise.all(assets.map(glyph=>{const image=new Image();image.src='/'+glyph.asset;return image.decode().then(()=>{if(image.naturalWidth!==glyph.width||image.naturalHeight!==glyph.height)throw new Error('Glyph size mismatch')})}));
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');context.font='12px "CDTank-SIMSUN"';
    return {fontCount:library.fonts.length,bitmapGlyphs:assets.length,dynamic:library.fonts.filter(f=>f.attributes.Type==='Dynamic'),
      stageFont:getComputedStyle(document.querySelector('.home-inventory-stage')).fontFamily,
      labelFont:getComputedStyle(document.querySelector('[data-inventory-instance="301"] span:last-child')).fontFamily,
      sourceLabel:document.querySelector('[data-inventory-instance="301"] span:last-child').textContent,
      textWidth:context.measureText('坦克宠物饲料').width,loadedFaces:Array.from(document.fonts).map(f=>({family:f.family,status:f.status}))};
  })()`);
  assert.equal(fonts.fontCount,12);assert.equal(fonts.bitmapGlyphs,122);assert(fonts.textWidth>0);
  assert(fonts.stageFont.includes('CDTank-SIMSUN'));assert(fonts.labelFont.includes('CDTank-SIMSUN'));assert(fonts.sourceLabel.includes('普通炮弹'));assert.equal(fonts.dynamic[0].glyphCount,22185);
  const sizes=[];
  for(const [width,height] of [[1920,1080],[3840,2160]]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`Math.abs(Number(document.querySelector('#home-inventory').style.zoom)-Math.min(innerWidth/800,innerHeight/600))<0.001`);
    const screenshot=await command('Page.captureScreenshot',{format:'png'},sessionId);
    await writeFile(`recovery/output/source-fonts-home-${width}.png`,Buffer.from(screenshot.data,'base64'));
    sizes.push({width,height});
  }
  await writeFile('recovery/output/browser-source-fonts.json',JSON.stringify({status:'PASS',scope:'Actual source outline font load, blocked-font failure and retry, all122 source bitmap glyph image dimensions, source font family applied to normal inventory pane, HD/4K UI screenshots. Original anti-aliasing/FreeType pixel metrics and full UI font integration remain unverified.',failure,fonts,sizes},null,2));
  console.log('PASS: source Chinese face, 12 font definitions, 122 glyph assets, failed-load retry and HD/4K inventory text');
} finally {
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});
  for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId});
  ws.close();await vite.close();await stop();await rm(directory,{recursive:true,force:true});
}
