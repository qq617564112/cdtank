import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const origin = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!endpoint) throw new Error('Usage: node tests/browser-battle.mjs <Chromium CDP WebSocket URL>');
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
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId});
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  const result = await evaluate(sessionId, `(async()=>{
    const {HomeTankPreview}=await import('/src/interface/home/home-tank-preview.ts');
    const preview=new HomeTankPreview();
    Object.assign(preview.element.style,{position:'fixed',left:'450px',top:'100px',width:'218px',height:'218px',zIndex:'10000'});
    document.body.append(preview.element);
    await preview.show(2,72);
    const deadline=Date.now()+45000;
    while(preview.element.dataset.renderedTankId!=='2'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
    if(preview.element.dataset.renderedTankId!=='2')throw new Error('Preview did not render');
    if(preview.camera.minZ!==10||preview.camera.maxZ!==5000)throw new Error('Original clip planes differ');
    const read=()=>({frames:Number(preview.element.dataset.frames),yaw:Number(preview.element.dataset.orbitYaw),alpha:preview.camera?.alpha??0});
    const before=read();
    while(Number(preview.element.dataset.frames)<before.frames+12)await new Promise(r=>setTimeout(r,20));
    const after=read();
    let expected=before.yaw;
    for(let frame=before.frames;frame<after.frames;frame++)expected=Math.fround(expected+Math.fround(.0075));
    if(expected!==after.yaw)throw new Error('Native per-update orbit differs');
    if(Math.abs(after.alpha-before.alpha-(after.yaw-before.yaw))>1e-9)throw new Error('Camera does not follow native increment');
    preview.scene.render();
    const screenshot=preview.canvas.toDataURL('image/png').split(',')[1];
    preview.clear();
    const frozen=read();await new Promise(r=>setTimeout(r,100));
    if(Number(preview.element.dataset.frames)!==frozen.frames)throw new Error('Closed preview is still rendering');
    preview.element.remove();
    return {before,after,expected,screenshot,clipPlanes:{near:10,far:5000},closeStopped:true};
  })()`);
  assert(result.closeStopped);
  await writeFile('recovery/output/home-preview-projection.png',Buffer.from(result.screenshot,'base64'));
  delete result.screenshot;
  await writeFile('recovery/output/browser-home-preview-orbit.json',JSON.stringify(result,null,2));
  console.log('PASS: actual preview camera follows native per-update float32 orbit and stops on close');
} finally {
  for (const page of pages) await command('Target.closeTarget', {targetId: page.targetId});
  ws.close();
}
