import {readFile, writeFile} from 'node:fs/promises';
import WebSocket from 'ws';

// Use the dedicated viewer tab in a local Chromium started with WebGPU enabled.
const [action = 'state', argument] = process.argv.slice(2);
const endpoint = process.env.CDTANK_VIEWER_CDP ?? 'http://127.0.0.1:9338';
let tab;
const tabDeadline = Date.now() + 20000;
while (!tab && Date.now() < tabDeadline) {
  const tabs = await (await fetch(`${endpoint}/json/list`)).json();
  tab = tabs.find(tab => tab.url.includes('/lighting-viewer.html'));
  if (!tab) await new Promise(resolve => setTimeout(resolve, 200));
}
if (!tab) throw new Error('Open /lighting-viewer.html in the diagnostic Chromium first.');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {socket.once('open', resolve); socket.once('error', reject);});
let sequence = 0;
const pending = new Map();
socket.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  clearTimeout(callback.timer);
  message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
});
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {pending.delete(id); reject(new Error(`CDP timeout: ${method}`));}, 45000);
    pending.set(id, {resolve, reject, timer});
    socket.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
try {
  if (action === 'shot' || action === 'resize') {
    const readyDeadline = Date.now() + 45000;
    while (!await evaluate('Boolean(window.lightingViewer?.ready)')) {
      if (Date.now() >= readyDeadline) throw new Error('Viewer did not become ready.');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  if (action === 'shot') {
    await evaluate('lightingViewer.frame()');
    const result = await command('Page.captureScreenshot', {format: 'png'});
    await writeFile(argument, Buffer.from(result.data, 'base64'));
    console.log(argument);
  } else if (action === 'resize') {
    await command('Emulation.setDeviceMetricsOverride', {width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false});
    console.log(await evaluate('lightingViewer.frame().then(()=>lightingViewer.state())'));
  } else if (action === 'reload') {
    await command('Page.reload', {ignoreCache: true});
    console.log('reloading');
  } else {
    const expression = action === 'eval-file' ? await readFile(argument, 'utf8')
      : action === 'eval' ? argument : 'lightingViewer.state()';
    console.log(JSON.stringify(await evaluate(expression), null, 2));
  }
} finally {
  socket.close();
}
