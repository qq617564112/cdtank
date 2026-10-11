/** Compare complete original and generated textures on original object geometry. */
import {spawn} from 'node:child_process';
import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {createServer} from '/workspace/cdtank/node_modules/vite/dist/node/index.js';
import WebSocket from '/workspace/cdtank/node_modules/ws/index.js';

const workspace = '/workspace/cdtank';
const model = process.argv[2], target = process.argv[3];
if (!model || !target) throw new Error('Usage: render.mjs OBJECT WORKSPACE [--original-only] [--group NAME]');
const output = `${target}/output/imagegen/map-api4k/${model}/renders`;
const temp = `/tmp/cdtank-api4k/map-render-${model}-${process.pid}`;
const inventory = JSON.parse(await readFile(`${workspace}/tools/map-api/inventory.json`, 'utf8'));
const object = inventory.objects.find(row => row.model === model);
if (!object) throw new Error(`Unknown object ${model}`);
const originalOnly = process.argv.includes('--original-only');
const geometry = object.models;
const variants = object.textures.map(row => row.filename);
const views = ['left', 'center', 'right', 'top', 'front', 'rear'];
const staticObjects = object.kind === 'static-map-objects';
const runtimeFolder = object.runtimeFolder || object.sourceFolder || `Data/scnobj/${model}`;
var groupIndex = process.argv.indexOf('--group');
var selectedGroup = groupIndex < 0 ? undefined : process.argv[groupIndex + 1];
if (groupIndex >= 0 && (!staticObjects || !object.reviewGroups.some(row => row.name === selectedGroup))) {
  throw new Error(`Unknown static object group ${selectedGroup}`);
}

function patchGlb(raw, mode, variant, group) {
  const length = raw.readUInt32LE(12);
  const document = JSON.parse(raw.subarray(20, 20 + length).toString());
  if (staticObjects) {
    const selected = new Set(object.reviewGroups.find(row => row.name === group).meshes);
    for (const node of document.nodes || []) {
      if (node.mesh !== undefined && !selected.has(document.meshes[node.mesh].name)) delete node.mesh;
    }
  }
  const textureNames = new Map();
  for (const material of document.materials || []) {
    const texture = material.pbrMetallicRoughness?.baseColorTexture;
    if (!texture) continue;
    const original = material.extras?.originalMV3?.textures?.[0] || material.name;
    const filename = object.textureAliases?.[material.name]
      || original.replaceAll('\\', '/').split('/').at(-1).replace(/\.[^.]+$/, '.png');
    textureNames.set(document.textures[texture.index].source, filename);
  }
  // One-texture animation and alternate skins use the same complete UV layout.
  for (const [index, filename] of textureNames) {
    if (staticObjects && mode === 'original') continue;
    if (staticObjects && !variants.includes(filename)) continue;
    const selected = !staticObjects && new Set(textureNames.values()).size === 1 && variants.length > 1 ? variant : filename;
    document.images[index] = {uri: selected, mimeType: 'image/png'};
  }
  const encoded = Buffer.from(JSON.stringify(document));
  const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32);
  encoded.copy(padded);
  const suffix = raw.subarray(20 + length);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + suffix.length, 8);
  header.writeUInt32LE(padded.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, padded, suffix]);
}

const moduleSource = String.raw`
import {ArcRotateCamera, Color3, Color4, Engine, LoadAssetContainerAsync, PBRMaterial, Scene, Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
const canvas = document.querySelector('canvas');
canvas.width = canvas.height = 900;
canvas.style.width = canvas.style.height = '900px';
const engine = new Engine(canvas, true, {preserveDrawingBuffer: true}, false);
const scene = new Scene(engine);
scene.clearColor = new Color4(.09, .11, .13, 1);
scene.ambientColor = Color3.White();
const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 100, Vector3.Zero(), scene);
camera.minZ = .01;
let container;
const views = {left:[0,Math.PI/2-.1],center:[-Math.PI/2,Math.PI/3],right:[Math.PI,Math.PI/2-.1],top:[-Math.PI/2,.01],front:[Math.PI/2,Math.PI/2-.1],rear:[-Math.PI/2,Math.PI/2-.1]};
async function renderAll(path) {
  container?.dispose();
  container = await LoadAssetContainerAsync(path, scene, {pluginOptions:{gltf:{useSRGBBuffers:false}}});
  container.addAllToScene();
  container.animationGroups.forEach(group=>{group.stop();group.reset();});
  for (const material of container.materials) {
    if (material instanceof PBRMaterial) material.unlit = true;
  }
  const meshes = container.meshes.filter(mesh=>mesh.getTotalVertices()>0);
  let minimum = new Vector3(Infinity,Infinity,Infinity), maximum = new Vector3(-Infinity,-Infinity,-Infinity);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    minimum = Vector3.Minimize(minimum,bounds.minimumWorld);
    maximum = Vector3.Maximize(maximum,bounds.maximumWorld);
  }
  const span = maximum.subtract(minimum), center = maximum.add(minimum).scale(.5);
  const radius = Math.max(span.length()*1.15, .1);
  camera.target = center;
  camera.radius = radius;
  camera.maxZ = Math.max(1000,radius*100);
  scene.render();
  await scene.whenReadyAsync();
  const result = {};
  for (const [name,[alpha,beta]] of Object.entries(views)) {
    camera.alpha=alpha;camera.beta=beta;
    scene.render();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    scene.render();
    result[name]=canvas.toDataURL('image/png');
  }
  return result;
}
window.objectHD={renderAll};
`;

let chrome, vite, socket;
let id = 0;
const pending = new Map();
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => {pending.delete(key); reject(new Error(`CDP timeout: ${method}`));}, 180000);
    pending.set(key, {resolve, reject, timer});
    socket.send(JSON.stringify({id: key, method, params, sessionId}));
  });
}
async function evaluate(sessionId, expression) {
  const result = await command('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
try {
  await mkdir(output, {recursive: true});
  await mkdir(temp, {recursive: true});
  vite = await createServer({
    configFile: false, root: workspace, publicDir: false, cacheDir: temp + '/vite',
    optimizeDeps: {noDiscovery: true, include: ['@babylonjs/core', '@babylonjs/loaders/glTF'], entries: []},
    server: {host: '127.0.0.1', port: 0, hmr: false},
    plugins: [{name: 'scene-object-render', configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        try {
          if (path === '/__object.html') {
            res.setHeader('Content-Type', 'text/html');
            res.end('<html><body style="margin:0"><canvas></canvas><script type="module" src="/__object-module.js"></script></body></html>');
            return;
          }
          if (path.startsWith('/__model/')) {
            const [, , mode, variant, ...parts] = path.split('/');
            if (path.endsWith('.png')) {
              const filename = decodeURIComponent(parts.at(-1));
              const reference = object.textures.find(row => row.filename === filename)?.reference;
              const root = mode === 'original' ? workspace : `${target}/apps/web/public/map-audit/api4k`;
              const relative = mode === 'original' ? reference : `${runtimeFolder}/${filename}`;
              if (!relative) throw new Error(`Unknown texture ${filename}`);
              res.setHeader('Content-Type', 'image/png');
              res.end(await readFile(`${root}/${relative}`));
              return;
            }
            res.setHeader('Content-Type', 'model/gltf-binary');
            res.end(patchGlb(await readFile(`${workspace}/art/original/${parts.join('/')}`), mode,
              decodeURIComponent(variant), decodeURIComponent(variant)));
            return;
          }
        } catch (error) {console.error(path, String(error)); res.statusCode = 500; res.end(String(error)); return;}
        next();
      });
    }, resolveId(id) {if (id === '/__object-module.js') return '\0object-module';},
    load(id) {if (id === '\0object-module') return moduleSource;}}],
  });
  await vite.listen();
  const origin = 'http://127.0.0.1:' + vite.httpServer.address().port;
  chrome = spawn('/home/node/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
    ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--remote-debugging-port=0', '--user-data-dir=' + temp + '/chrome', 'about:blank'],
    {stdio: ['ignore', 'ignore', 'pipe']});
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Chrome launch timeout')), 30000);
    chrome.stderr.on('data', data => {
      log += String(data);
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(log);
      if (match) {clearTimeout(timer); resolve(match[1]);}
    });
    chrome.once('exit', () => {clearTimeout(timer); reject(new Error(log));});
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {socket.once('open', resolve); socket.once('error', reject);});
  socket.on('message', raw => {
    const message = JSON.parse(String(raw)), request = pending.get(message.id);
    if (request) {
      clearTimeout(request.timer); pending.delete(message.id);
      message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
    }
  });
  const {targetId} = await command('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  await command('Page.enable', {}, sessionId);
  await command('Runtime.enable', {}, sessionId);
  await command('Page.navigate', {url: origin + '/__object.html'}, sessionId);
  for (let attempt = 0; attempt < 400; attempt++) {
    if (await evaluate(sessionId, 'Boolean(window.objectHD)')) break;
    await new Promise(resolve => setTimeout(resolve, 300));
    if (attempt === 399) throw new Error('Object renderer did not load');
  }
  const scope = selectedGroup ? JSON.parse(await readFile(`${output}/scope.json`, 'utf8')).models : [];
  const jobs = staticObjects ? object.reviewGroups.filter(group => !selectedGroup || group.name === selectedGroup)
    .map(group => ({path: geometry[0], group: group.name}))
    : geometry.map(path => ({path}));
  for (const job of jobs) {
    const path = job.path;
    const raw = await readFile(`${workspace}/art/original/${path}`);
    const document = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString());
    const materialNames = new Set((document.materials || []).map(row => row.name));
    const selectedVariants = staticObjects ? [job.group]
      : object.modelTextures?.[path] || (materialNames.size === 1 ? variants : [variants[0]]);
    for (const variant of selectedVariants) {
      const action = job.group || path.split('/').at(-1).replace(/\.glb$/, '');
      const folder = `${output}/${action}/${variant.replace(/\.png$/, '')}`;
      await mkdir(folder, {recursive: true});
      for (const mode of originalOnly ? ['original'] : ['original', 'api4k']) {
        const url = `/__model/${mode}/${encodeURIComponent(variant)}/${path}`;
        const images = await evaluate(sessionId, 'window.objectHD.renderAll(' + JSON.stringify(url) + ')');
        for (const [view, data] of Object.entries(images)) {
          await writeFile(`${folder}/${mode}-${view}.png`, Buffer.from(data.split(',')[1], 'base64'));
        }
        console.log(`Rendered ${model} ${action} ${variant} ${mode}`);
      }
      var item = {asset: path, action, variant, views};
      var existing = scope.findIndex(row => row.asset === path && row.action === action && row.variant === variant);
      if (existing < 0) scope.push(item);
      else scope[existing] = item;
    }
  }
  await writeFile(`${output}/scope.json`, JSON.stringify({object: model, ambientLight: true,
    modes: originalOnly ? ['original'] : ['original', 'api4k'], models: scope}, null, 2) + '\n');
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  socket?.close();
  if (chrome?.pid && chrome.exitCode === null) {
    const exited = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill();
    await exited;
  }
  await vite?.close();
  await rm(temp, {recursive: true, force: true});
}
