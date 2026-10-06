import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

var require = createRequire(import.meta.url);
var WebSocket = require('ws');
var endpoint = process.argv[2];
var origin = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!endpoint) throw new Error('Usage: node tests/browser-battle-input.mjs <Chromium CDP WebSocket URL> [origin]');
var ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
var sequence = 0;
var pending = new Map();
ws.on('message', raw => {
  var message = JSON.parse(String(raw));
  var callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    var id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  var result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
var page;
var session;
async function key(code, down = true, repeat = false) {
  var keys = {KeyW: ['w', 87], KeyS: ['s', 83], KeyA: ['a', 65], KeyD: ['d', 68],
    ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39], KeyQ: ['q',81], KeyE: ['e',69], Space: [' ', 32], Digit1: ['1', 49], Digit8: ['8', 56]};
  var [value, keyCode] = keys[code];
  await command('Input.dispatchKeyEvent', {type: down ? 'rawKeyDown' : 'keyUp',
    key: value, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
    autoRepeat: repeat}, session);
}
async function sample() {
  return evaluate(session, `(()=>{window.inputDiagnostic.input.send();return window.inputDiagnostic.messages.at(-1);})()`);
}
function controls(message, expected) {
  assert.deepEqual({move: message.move, turn: message.turn, aim: message.aim,
    fire: message.fire, useItem: message.useItem}, expected);
  assert(Number.isFinite(message.clientTime));
}
var neutral = {move: 0, turn: 0, aim: 0, fire: false, useItem: 0};
try {
  ({targetId: page} = await command('Target.createTarget', {url: origin, newWindow: true}));
  ({sessionId: session} = await command('Target.attachToTarget', {targetId: page, flatten: true}));
  await command('Page.bringToFront', {}, session);
  var loadDeadline = Date.now() + 45000;
  while (!await evaluate(session, 'Boolean(document.querySelector("#world"))').catch(error => {
    if (!String(error).includes('Execution context was destroyed')) throw error;
    return false;
  })) {
    if (Date.now() > loadDeadline) throw new Error('Production page did not load');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  await evaluate(session, `(async()=>{
    const {BattleInput}=await import('/src/match/battle-input.ts');
    const context={active:true,playing:true,connected:true,autopilot:false};
    const messages=[];
    const input=new BattleInput(()=>context,message=>messages.push({...message}));
    const controls=document.createElement('section');
    controls.id='input-diagnostic-controls';
    for(const tag of ['input','select','button','textarea'])controls.append(document.createElement(tag));
    document.body.append(controls);
    const canvas=document.querySelector('#world');canvas.tabIndex=0;canvas.focus();
    window.inputDiagnostic={BattleInput,context,messages,input,controls,canvas};
  })()`);
  await key('KeyW'); await key('KeyD'); await key('ArrowRight'); await key('Space');
  var moving = await sample();
  controls(moving, {move: 1, turn: -1, aim: -1, fire: true, useItem: 0});
  assert.equal(moving.sequence, 1);
  await key('KeyS'); await key('KeyA'); await key('ArrowLeft');
  controls(await sample(), {...neutral, fire: true});
  for (var code of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space']) await key(code, false);
  controls(await sample(), neutral);
  await key('KeyA'); await key('ArrowLeft');
  controls(await sample(), {...neutral, turn: 1, aim: 1});
  await key('KeyA', false); await key('ArrowLeft', false);
  controls(await sample(), neutral);
  var beforeShortcut = await evaluate(session, 'inputDiagnostic.messages.length');
  await key('Digit1'); await key('Digit1', true, true); await key('Digit1', false);
  await key('Digit8'); await key('Digit8', false);
  assert.deepEqual(await evaluate(session, `inputDiagnostic.messages.slice(${beforeShortcut}).map(message=>message.useItem)`), [1, 8]);
  await key('KeyW');
  for (var tag of ['input', 'select', 'button']) {
    await evaluate(session, `inputDiagnostic.controls.querySelector('${tag}').focus()`);
    var beforeBlocked = await evaluate(session, 'inputDiagnostic.messages.length');
    await key('KeyW'); await key('Digit1'); await key('Digit1', false);
    assert.equal(await evaluate(session, 'inputDiagnostic.messages.length'), beforeBlocked);
    controls(await sample(), neutral);
    await key('KeyW', false);
  }
  await evaluate(session, 'inputDiagnostic.canvas.focus()');
  await key('KeyW');
  // A real browser focus transition clears keys even for a textarea.
  await evaluate(session, 'inputDiagnostic.controls.querySelector("textarea").focus()');
  controls(await sample(), neutral);
  await evaluate(session, 'inputDiagnostic.canvas.focus()');
  await key('KeyW');
  // Exercise window blur explicitly; control focus uses actual browser focus.
  await evaluate(session, "window.dispatchEvent(new Event('blur'))");
  controls(await sample(), neutral);
  await key('KeyW', false);
  var transitions = await evaluate(session, `(async()=>{
    const {input,context,messages}=inputDiagnostic;
    const wait=()=>new Promise(resolve=>setTimeout(resolve,180));
    const count=()=>messages.length;
    const assert=(condition,message)=>{if(!condition)throw new Error(message);};
    input.start();
    const start=count();await wait();assert(count()>start,'Live interval did not send');
    input.stop();const stopped=count();await wait();assert(count()===stopped,'Stopped interval sent');
    const observations=[];
    for(const [name,patch] of [['WAITING',{playing:false}],['FINISHED',{playing:false}],
      ['inactive',{active:false}],['disconnected',{connected:false}],['autopilot',{autopilot:true}]]){
      Object.assign(context,{active:true,playing:true,connected:true,autopilot:false},patch);
      input.clear();input.start();const before=count();await wait();
      assert(count()===before,name+' interval sent');input.stop();
      if(name==='disconnected'||name==='autopilot'){
        input.send(1);assert(count()===before,name+' direct send escaped gate');
      }
      observations.push({phase:name,messages:count()-before});
    }
    Object.assign(context,{active:true,playing:true,connected:true,autopilot:false});
    input.start();const resumed=count();await wait();input.stop();
    assert(count()>resumed,'Recovered playing interval did not resume');
    const sequence=messages.at(-1).sequence;input.clear();input.send();
    assert(messages.at(-1).sequence===sequence+1,'Clear reset sequence');
    input.resetSequence();input.send();assert(messages.at(-1).sequence===1,'Entry reset did not reset sequence');
    const secondMessages=[];
    const second=new inputDiagnostic.BattleInput(()=>context,message=>secondMessages.push(message));
    second.send();input.send();second.send();second.stop();second.clear();
    assert(secondMessages[0].sequence===1&&secondMessages[1].sequence===2,'Independent sequence shared');
    assert(messages.at(-1).sequence===2,'Second owner changed first sequence');
    return {observations,timerSent:stopped-start,resumedMessages:count()-resumed,
      clearPreservesSequence:true,entryResetsSequence:true,independentSequence:true};
  })()`);
  await evaluate(session, `(async()=>{
    const {input,context,messages,canvas}=inputDiagnostic;
    context.playing=false;input.clear();canvas.focus();
    window.inputDiagnostic.blockedCount=messages.length;
  })()`);
  await key('KeyW'); await key('Digit1'); await key('Digit1', false);
  assert.equal(await evaluate(session, 'inputDiagnostic.messages.length'), await evaluate(session, 'inputDiagnostic.blockedCount'));
  await evaluate(session, 'inputDiagnostic.context.playing=true');
  controls(await sample(), neutral);
  await key('KeyW', false);
  await writeFile('recovery/output/browser-battle-input.json', JSON.stringify({
    source: 'diagnostic BattleInput instance on production page; actual Chromium keyboard, control focus and interval events; explicit synthetic window blur',
    origin, mapping: true, oppositeKeysCancel: true, keyup: true,
    shortcutNoRepeat: true, focusedControls: true, textareaFocusClears: true,
    syntheticWindowBlurClears: true, phaseRejectsKeydown: true, transitions,
  }, null, 2));
  console.log('PASS: diagnostic browser input mapping, control focus and synthetic window blur release, shortcuts, phase/transport/autopilot transitions, timer stop/resume and independent sequences');
} finally {
  if (session) await evaluate(session, `(()=>{
    const diagnostic=window.inputDiagnostic;if(!diagnostic)return;
    diagnostic.input.stop();diagnostic.input.clear();diagnostic.controls.remove();
    delete window.inputDiagnostic;
  })()`).catch(() => {});
  if (page) await command('Target.closeTarget', {targetId: page});
  ws.close();
}
