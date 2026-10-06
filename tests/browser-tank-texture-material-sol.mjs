import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

var WebSocket = createRequire(import.meta.url)('ws');
var endpoint = process.argv[2];
var pageUrl = process.argv[3] ?? 'http://127.0.0.1:5199';
assert(endpoint, 'Usage: node tests/browser-tank-texture-material-sol.mjs <CDP WebSocket URL> [page URL]');
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

/** Draw the production material entrypoint and read the actual WebGL framebuffer. */
async function browserFixture() {
  var response = await fetch('/src/render/materials/mv3-material.ts');
  var source = await response.text();
  var moduleUrl = source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
  var {Engine, Scene, FreeCamera, Vector3, Color4, Mesh, VertexData, RawTexture,
    Texture, PBRMaterial, ShaderMaterial, AssetContainer} = await import(moduleUrl);
  var {applyMv3Materials, createMv3Material} = await import('/src/render/materials/mv3-material.ts');
  var canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  document.body.append(canvas);
  var engine = new Engine(canvas, false, {preserveDrawingBuffer: true, premultipliedAlpha: false}, false);
  var scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 1);
  var camera = new FreeCamera('actor-texture-pixels', new Vector3(0, 0, -3), scene);
  camera.setTarget(Vector3.Zero());
  camera.mode = 1;
  camera.orthoLeft = -2;
  camera.orthoRight = 2;
  camera.orthoTop = 2;
  camera.orthoBottom = -2;
  var properties = [1, 1, 1, 1, .5, .75, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 12.8];
  var rows = [];
  var gl = engine._gl;
  function check(value, expected, label) {
    if (JSON.stringify(value) !== JSON.stringify(expected)) {
      throw new Error(label + ' ' + JSON.stringify({value, expected}));
    }
  }
  function texture(bytes) {
    return RawTexture.CreateRGBATexture(new Uint8Array(bytes), 1, 1, scene, false, false,
      Texture.NEAREST_SAMPLINGMODE);
  }
  function quad(name, x) {
    var mesh = new Mesh(name, scene);
    var data = new VertexData();
    data.positions = [-.7, -.7, 0, .7, -.7, 0, .7, .7, 0, -.7, .7, 0];
    data.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    data.indices = [0, 1, 2, 0, 2, 3];
    data.applyToMesh(mesh);
    mesh.position.x = x;
    return mesh;
  }
  function sourceMaterial(name, legacyTexture, tagged = true) {
    var material = new PBRMaterial(name, scene);
    material.albedoTexture = legacyTexture;
    if (tagged) material.metadata = {gltf: {extras: {originalMV3: {
      properties: [...properties], textures: ['dipan.TGA', '', '', ''],
    }}}};
    return material;
  }
  function pixel(x, y) {
    var values = new Uint8Array(4);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, values);
    return [...values];
  }
  async function draw(...meshes) {
    for (var mesh of meshes) await mesh.material.forceCompilationAsync(mesh);
    scene.render();
    gl.finish();
    check(gl.getError(), gl.NO_ERROR, 'WebGL error');
  }
  try {
    var red = texture([255, 0, 0, 255]);
    var green = texture([0, 255, 0, 255]);
    var blue = texture([0, 0, 255, 255]);
    var first = quad('selected-actor', -1);
    var second = quad('original-actor', 1);
    first.material = sourceMaterial('first-source', red);
    second.material = sourceMaterial('second-source', red);
    var originalMetadata = JSON.stringify(first.material.metadata);
    var firstSourceMetadata = first.material.metadata;
    var firstMaterials = applyMv3Materials(scene, [first], blue);
    var secondMaterials = applyMv3Materials(scene, [second]);
    check(firstMaterials.length, 1, 'selected material');
    check(secondMaterials.length, 1, 'legacy material');
    check(first.material === second.material, false, 'independent actor material');
    check(JSON.stringify(firstSourceMetadata), originalMetadata, 'source metadata remains original');
    check(first.material.metadata.originalMV3.properties, properties, '17 original properties');
    await draw(first, second);
    check(pixel(32, 64), [0, 0, 51, 255], 'selected texture replaces legacy');
    check(pixel(96, 64), [26, 0, 0, 255], 'other actor retains legacy texture');
    rows.push({case: 'selected-versus-legacy', selected: pixel(32, 64), other: pixel(96, 64)});
    var switched = applyMv3Materials(scene, [first], green);
    await draw(first, second);
    check(pixel(32, 64), [0, 38, 0, 255], 'selected actor switches');
    check(pixel(96, 64), [26, 0, 0, 255], 'switch cannot affect other actor');
    check(red.isReady() && blue.isReady() && green.isReady(), true, 'all borrowed textures survive switch');
    rows.push({case: 'switch-independent-instance', selected: pixel(32, 64), other: pixel(96, 64)});

    var unresolved = sourceMaterial('unresolved-source', null);
    var third = quad('unresolved-actor', -1);
    third.setEnabled(false);
    third.material = unresolved;
    check(applyMv3Materials(scene, [third]).length, 0, 'no chosen skin retains unresolved source');
    check(third.material === unresolved, true, 'no default replacement');
    var thirdMaterials = applyMv3Materials(scene, [third], blue);
    check(third.material instanceof ShaderMaterial, true, 'explicit override resolves legacy gap');
    first.setEnabled(false);
    third.setEnabled(true);
    await draw(third, second);
    check(pixel(32, 64), [0, 0, 51, 255], 'unresolved legacy uses chosen texture');
    rows.push({case: 'unresolved-source-explicit-only', selected: pixel(32, 64)});

    var untagged = sourceMaterial('POL-source', red, false);
    var fourth = quad('untagged', 0);
    fourth.setEnabled(false);
    fourth.material = untagged;
    check(applyMv3Materials(scene, [fourth], blue).length, 0, 'untagged source untouched');
    check(fourth.material === untagged, true, 'POL source material retained');
    var opacityMesh = quad('opacity-source', 0);
    opacityMesh.setEnabled(false);
    opacityMesh.material = createMv3Material(scene, properties, undefined, .5);
    var opacityMaterials = applyMv3Materials(scene, [opacityMesh], blue);
    check(opacityMesh.material.metadata.originalMV3.opacity, .5, 'reapply opacity');
    check(opacityMesh.material.metadata.originalMV3.script, 'geom_t', 'reapply alpha script');
    check(opacityMesh.material.metadata.originalMV3.properties, properties, 'reapply source properties');
    check([blue.samplingMode, blue.wrapU, blue.wrapV], [2, 1, 1], 'LINEAR WRAP sampler');
    var alpha100 = texture([0, 0, 255, 200]);
    var alpha101 = texture([0, 0, 255, 202]);
    opacityMesh.setEnabled(true);
    third.setEnabled(false);
    opacityMaterials = applyMv3Materials(scene, [opacityMesh], alpha100);
    await draw(opacityMesh, second);
    check(pixel(64, 64), [0, 0, 0, 255], 'selected alpha100 discard');
    opacityMaterials = applyMv3Materials(scene, [opacityMesh], alpha101);
    await draw(opacityMesh, second);
    check(pixel(64, 64), [0, 0, 20, 255], 'selected alpha101 blend');
    rows.push({case: 'selected-geom_t-alpha', discarded: [0, 0, 0, 255], blended: pixel(64, 64)});

    var action = new AssetContainer(scene);
    action.meshes.push(first, third, opacityMesh);
    action.materials.push(...switched, ...thirdMaterials, ...opacityMaterials);
    action.dispose();
    check(red.isReady() && blue.isReady() && green.isReady(), true, 'action disposal preserves borrowed textures');
    await draw(second);
    check(pixel(96, 64), [26, 0, 0, 255], 'surviving actor still draws after other disposal');
    rows.push({case: 'action-release', borrowedTexturesReady: true, survivingActor: pixel(96, 64)});
    var sharedA = quad('shared-component-a', 0);
    var sharedB = quad('shared-component-b', 0);
    sharedA.setEnabled(false);
    sharedB.setEnabled(false);
    sharedA.material = sharedB.material = sourceMaterial('one-action-shared', red);
    check(applyMv3Materials(scene, [sharedA, sharedB], green).length, 1, 'one replacement per source in action');
    check(sharedA.material === sharedB.material, true, 'component meshes retain shared material');
    return {rows, sourceProperties: properties, selectedSampling: [blue.samplingMode, blue.wrapU, blue.wrapV],
      readback: 'WebGL framebuffer gl.readPixels', renderer: gl.getParameter(gl.RENDERER)};
  } finally {
    scene.dispose();
    engine.dispose();
    canvas.remove();
  }
}

var targetId;
try {
  ({targetId} = await command('Target.createTarget', {url: pageUrl}));
  var {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  var result;
  for (var attempt = 0; attempt < 60; attempt++) {
    try {
      result = await evaluate(sessionId, '(' + browserFixture.toString() + ')()');
      break;
    } catch (error) {
      if (attempt === 59 || !String(error).match(/navigated|context.*destroyed|Cannot read properties of null|Failed to fetch|Failed to parse URL/)) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  await writeFile('recovery/output/browser-tank-texture-material-sol.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: selected/legacy framebuffer, unresolved source explicit override, actor isolation, original properties/opacity/sampler, borrowed texture release');
} finally {
  if (targetId) await command('Target.closeTarget', {targetId}).catch(() => {});
  ws.close();
}
