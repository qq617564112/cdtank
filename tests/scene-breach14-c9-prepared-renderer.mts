import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {NullEngine, RawTexture, Scene, Texture} from '@babylonjs/core';
import {EffectModelRenderer, type EffectModelLibrary} from '../apps/web/src/render/effects/models/effect-model-renderer';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';

const library = JSON.parse(readFileSync('recovery/prepared/scene-breach14-assets/scene-breach-0014.json','utf8')) as EffectModelLibrary;
const engine = new NullEngine();
const scene = new Scene(engine);
const textures = new Map<string, Texture>();
for (const resource of library.resources) for (const node of resource.nodes) for (const part of node.parts) {
  if (part.asset && !textures.has(part.asset)) textures.set(part.asset,
    RawTexture.CreateRGBATexture(new Uint8Array([255,255,255,255]),1,1,scene));
}
const baseline = {meshes:scene.meshes.length, materials:scene.materials.length};
const rows = [];
for (const resource of library.resources) {
  let delta = 0;
  const renderer = new EffectModelRenderer(scene,resource,library,textures,()=>delta,-1,resource.reference);
  renderer.setTime(0);renderer.setRate(1);renderer.update();
  renderer.draw({matrix:EFFECT_IDENTITY,blend:1,alpha:1,priority:-1});
  const count = resource.nodes.reduce((sum,node)=>sum+node.parts.length,0);
  assert.equal(renderer.meshes.length,count);
  assert(renderer.meshes.every(mesh=>mesh.getTotalVertices()>0&&mesh.isEnabled()));
  delta = .1;renderer.update();renderer.draw({matrix:EFFECT_IDENTITY,blend:1,alpha:.95,priority:-1});
  renderer.draw(undefined);assert(renderer.meshes.every(mesh=>!mesh.isEnabled()));
  renderer.dispose();
  assert.equal(scene.meshes.length,baseline.meshes);
  assert.equal(scene.materials.length,baseline.materials);
  rows.push({reference:resource.reference,geometryParts:count,backendConstructs:true,hideAndDispose:true});
}
writeFileSync('recovery/output/scene-breach14-c9-prepared-renderer.json',JSON.stringify({
  status:'PASS_PREPARED_MAP14_C9_RENDERER_BINDINGS',models:rows,
  scope:'Existing backend with new original c9 data; synthetic texture handles test ownership only. Source DDS pixels verified separately; no GPU or ordinary player output.'
},null,2)+'\n');
scene.dispose();engine.dispose();console.log('PASS_PREPARED_MAP14_C9_RENDERER_BINDINGS');
