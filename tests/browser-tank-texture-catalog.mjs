import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

var WebSocket = createRequire(import.meta.url)('ws');
var pageUrl = process.argv[3] ?? 'http://127.0.0.1:5198';
var endpoint = process.argv[2];
if (!endpoint) endpoint = (await (await fetch('http://127.0.0.1:9252/json/version')).json()).webSocketDebuggerUrl;
var ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
var sequence = 0;
var pending = new Map();
ws.on('message', raw => {
  var response = JSON.parse(String(raw));
  var callback = pending.get(response.id);
  if (!callback) return;
  pending.delete(response.id);
  if (response.error) callback.reject(new Error(JSON.stringify(response.error)));
  else callback.resolve(response.result);
});
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    var id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(sessionId, expression) {
  var result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

/** Each catalog PNG is decoded independently and sampled with the production material. */
async function browserFixture() {
  function check(condition, label, detail) {
    if (!condition) throw new Error(label + ': ' + JSON.stringify(detail));
  }
  var catalog = await (await fetch('/tank-textures.json')).json();
  check(catalog.rows.length === 711, 'catalog row count', catalog.rows.length);
  var resolved = [];
  for (var row of catalog.rows) {
    for (var variant of ['A', 'B']) {
      var entry = row.textures[variant];
      if (entry?.status === 'resolved') resolved.push({row, variant, entry});
    }
  }
  check(resolved.length === 680, 'resolved A/B count', resolved.length);
  var source = await (await fetch('/src/render/materials/mv3-material.ts')).text();
  var moduleUrl = source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
  var {Engine, EngineStore, Scene, FreeCamera, Vector3, Color4, Mesh, VertexData, Texture} = await import(moduleUrl);
  var {createMv3Material} = await import('/src/render/materials/mv3-material.ts');
  var canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  document.body.append(canvas);
  var engine = new Engine(canvas, false, {preserveDrawingBuffer: true, premultipliedAlpha: false}, false);
  var gl = engine._gl;
  var decoder = document.createElement('canvas');
  var context = decoder.getContext('2d', {willReadFrequently: true});
  var properties = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 12.8];
  var rows = [];
  var result = {catalogRows: catalog.rows.length, resolvedTextures: resolved.length,
    sampling: 'LINEAR min/mag, REPEAT U/V, no mipmaps',
    readback: 'WebGL framebuffer gl.readPixels', expected: 'PNG Image decode + Canvas2D getImageData, RGB * 0.2, source alpha',
    properties, canvas: [64, 64], pixelTolerance: 1,
    renderer: gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION),
    contextAttributes: gl.getContextAttributes(), rows};
  var debug = gl.getExtension('WEBGL_debug_renderer_info');
  if (debug) result.unmaskedRenderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
  try {
    for (var item of resolved) {
      var url = new URL('/' + item.entry.asset, location.origin).href;
      var image = new Image();
      image.src = url;
      await image.decode();
      decoder.width = image.naturalWidth;
      decoder.height = image.naturalHeight;
      context.drawImage(image, 0, 0);
      var scene = new Scene(engine);
      try {
        scene.clearColor = new Color4(0, 0, 0, 1);
        var camera = new FreeCamera('catalog-pixels', new Vector3(0, 0, -3), scene);
        camera.setTarget(Vector3.Zero());
        camera.mode = 1;
        camera.orthoLeft = -1;
        camera.orthoRight = 1;
        camera.orthoTop = 1;
        camera.orthoBottom = -1;
        var texture = await new Promise((resolve, reject) => {
          var loaded = new Texture(url, scene, true, true, Texture.NEAREST_SAMPLINGMODE,
            () => resolve(loaded), (message, error) => reject(new Error(message, {cause: error})));
        });
        var size = texture.getSize();
        check(texture.isReady(), 'texture readiness', url);
        check(size.width === image.naturalWidth && size.height === image.naturalHeight,
          'PNG/GPU dimensions', {url, gpu: size, png: [image.naturalWidth, image.naturalHeight]});
        var material = createMv3Material(scene, properties, texture);
        var samples = [];
        var fractions = [[.17, .23], [.67, .29], [.31, .73], [.79, .83]];
        for (var index = 0; index < fractions.length; index++) {
          var x = Math.floor((size.width - 1) * fractions[index][0]);
          var y = Math.floor((size.height - 1) * fractions[index][1]);
          var u = (x + .5) / size.width;
          var v = 1 - (y + .5) / size.height;
          var mesh = new Mesh('catalog-probe-' + index, scene);
          var data = new VertexData();
          data.positions = [-.4, -.4, 0, .4, -.4, 0, .4, .4, 0, -.4, .4, 0];
          // Constant UV at an interior texel center avoids LINEAR interpolation ambiguity.
          data.uvs = [u, v, u, v, u, v, u, v];
          data.indices = [0, 1, 2, 0, 2, 3];
          data.applyToMesh(mesh);
          mesh.position.x = index % 2 === 0 ? -.5 : .5;
          mesh.position.y = index < 2 ? -.5 : .5;
          mesh.material = material;
          var rgba = [...context.getImageData(x, y, 1, 1).data];
          samples.push({pngPixel: [x, y], uv: [u, v],
            framebufferPixel: [index % 2 === 0 ? 16 : 48, index < 2 ? 16 : 48],
            sourceRGBA: rgba, expected: rgba.map((component, channel) => channel === 3 ? component : Math.round(component * .2))});
        }
        await material.forceCompilationAsync(scene.meshes[0]);
        scene.render();
        gl.finish();
        check(gl.getError() === gl.NO_ERROR, 'WebGL draw error', url);
        for (var sample of samples) {
          var bytes = new Uint8Array(4);
          gl.readPixels(...sample.framebufferPixel, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
          sample.actual = [...bytes];
          check(sample.actual.every((value, channel) => Math.abs(value - sample.expected[channel]) <= 1),
            'production material PNG sample', {recordId: item.row.recordId, variant: item.variant, url, sample});
        }
        var binding = gl.getParameter(gl.TEXTURE_BINDING_2D);
        gl.bindTexture(gl.TEXTURE_2D, texture.getInternalTexture()._hardwareTexture.underlyingResource);
        var sampler = [gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER),
          gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER),
          gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S),
          gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T)];
        gl.bindTexture(gl.TEXTURE_2D, binding);
        check(JSON.stringify(sampler) === JSON.stringify([gl.LINEAR, gl.LINEAR, gl.REPEAT, gl.REPEAT]),
          'actual GPU LINEAR WRAP sampler', {url, sampler});
        check(!material.needAlphaBlending(), 'opaque source properties', url);
        rows.push({recordId: item.row.recordId, tankId: item.row.tankId, part: item.row.part,
          variant: item.variant, request: item.entry.request, source: item.entry.source,
          asset: item.entry.asset, url, dimensions: [size.width, size.height], ready: true,
          sampler, samples});
      } finally {
        scene.dispose();
      }
      var cleanup = {scenes: engine.scenes.length, textures: engine.getLoadedTexturesCache().length};
      check(cleanup.scenes === 0 && cleanup.textures === 0, 'per-texture resource release', {url, cleanup});
      rows[rows.length - 1].cleanup = cleanup;
      image.src = '';
      if (rows.length % 100 === 0) console.log('catalog GPU rows: ' + rows.length + '/680');
    }
    result.sampleCount = rows.reduce((count, row) => count + row.samples.length, 0);
    result.finalResources = {scenes: engine.scenes.length, textures: engine.getLoadedTexturesCache().length};
    return result;
  } finally {
    engine.dispose();
    canvas.remove();
    decoder.width = decoder.height = 1;
    result.finalResources ??= {};
    result.finalResources.engines = EngineStore.Instances.length;
    check(result.finalResources.engines === 0, 'final engine release', result.finalResources);
  }
}

var targetId;
try {
  ({targetId} = await command('Target.createTarget', {url: new URL('/tank-textures.json', pageUrl).href}));
  var {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  // Wait only for navigation; never repeat the GPU catalog acceptance on a failure.
  for (var attempt = 0; attempt < 60; attempt++) {
    try {
      if (await evaluate(sessionId, 'location.pathname === "/tank-textures.json" && document.readyState === "complete"')) break;
    } catch (error) {
      if (!String(error).match(/navigated|context.*destroyed|Cannot find context/)) throw error;
    }
    assert(attempt < 59, 'catalog page navigation timed out');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  var result = await evaluate(sessionId, '(' + browserFixture.toString() + ')()');
  await writeFile('recovery/output/browser-tank-texture-catalog.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: 711 catalog rows; 680 resolved A/B PNGs loaded on GPU; ' + result.sampleCount +
    ' production-material framebuffer samples; actual LINEAR/WRAP; resources ' + JSON.stringify(result.finalResources));
} finally {
  if (targetId) await command('Target.closeTarget', {targetId}).catch(() => {});
  ws.close();
}
