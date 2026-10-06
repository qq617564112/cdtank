import {BattleSkillEffects} from '../apps/web/src/match/skills/battle-skill-effects';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectModelLibrary} from '../apps/web/src/render/effects/models/effect-model-renderer';
import {EffectRuntimeTree, EffectRuntimeLibrary} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EFFECT_PRIMARY_TAGS} from '../apps/web/src/assets/tanks/effect-tag-matrices';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {createSkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-runtime';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
const native=JSON.parse(readFileSync('recovery/output/skill-effect-actor-native.json','utf8')) as {
  nestedStop:{kind:string;node:number}[];tags:string[];rows:{tag:number;oneShot:number;clipped:boolean;local:boolean;present:boolean;result:number}[];
};
const engine=new NullEngine(); const scene=new Scene(engine);
const camera=new FreeCamera('camera',new Vector3(0,0,-100),scene); camera.setTarget(Vector3.Zero());
camera.getViewMatrix(true);camera.getProjectionMatrix(true);
const runtime=new EffectRuntime(scene,camera);
const loaded=runtime as unknown as {library:unknown;modelLibrary:unknown; textures:Map<string,RawTexture>;instances:{handle:number;tree:EffectRuntimeTree}[]};
const library=JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json','utf8')) as EffectRuntimeLibrary & {boltTextures:{asset:string}[]};
const models=JSON.parse(readFileSync('recovery/output/web-assets/effect-models.json','utf8')) as EffectModelLibrary;
const creations=JSON.parse(readFileSync('recovery/output/effect-tree-create-native.json','utf8')) as {rows:{node:number;retain:boolean;created:{node:number;retain:boolean}[]}[]};
const nativeRoot=creations.rows.find(row=>row.node===2469&&!row.retain)!.created;
loaded.library=library;loaded.modelLibrary=models;
for(const asset of new Set([...library.textureGrids.map(row=>row.asset),...library.boltTextures.map(row=>row.asset),
  ...models.resources.flatMap(row=>row.nodes.flatMap(node=>node.parts.map(part=>part.asset)))]
  .filter((asset): asset is string => Boolean(asset)))) {
  loaded.textures.set(asset,RawTexture.CreateRGBATexture(new Uint8Array([255,255,255,255]),1,1,scene));
}
const root=new TransformNode('actor',scene);
const matrices=EFFECT_PRIMARY_TAGS.map(()=>[...EFFECT_IDENTITY]);
let tagPresent=true;
const view={root,primaryTag:(name:string)=>tagPresent ? matrices[EFFECT_PRIMARY_TAGS.indexOf(name as typeof EFFECT_PRIMARY_TAGS[number])] : undefined} as unknown as TankView;
runtime.start();assert.deepEqual(EFFECT_PRIMARY_TAGS,native.tags);
for(const [index,row] of native.rows.entries()) {
  root.position.x=row.clipped?100000:0;tagPresent=row.present;
  const handle=runtime.spawnAttachedEffect(view,19,row.tag,Boolean(row.oneShot),row.local?view:undefined);
  assert.equal(Boolean(handle),Boolean(row.result),`native actor case${index}`);
  if(handle) {
    const tree=loaded.instances.find(instance=>instance.handle===handle)!.tree;
    assert.equal(tree.parentMatrix,matrices[row.tag]);
    assert.deepEqual(tree.nodes.map(node=>({node:node.definition.index,retain:node.lifecycle.retainWhenEnded})),nativeRoot);
    assert.ok(tree.nodes.every(node=>!node.lifecycle.retainWhenEnded));
    runtime.stopEffect(handle);assert.equal(loaded.instances.length,0);
    assert.ok(tree.nodes.every(node=>node.lifecycle.phase===0));
  }
}
root.position.x=0;tagPresent=true;
const catalog=JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json','utf8')) as CombatCatalog;
const notifications=createSkillEffectNotifications(runtime,catalog,{role:id=>id===47?view:undefined,localRole:()=>view});
const battleEffects=new BattleSkillEffects(notifications);
battleEffects.event({roomId:'R1',type:'skillEffect',message:'',playerId:'P47',targetId:'',
  value:0,x:0,y:0,z:0,
  playSkillEffect:{skillId:12,effectIndex:0,duration:10,roleId:47,xBits:0,zBits:0}});
assert.equal(notifications.records.length,0);
assert.equal(loaded.instances.length,1);assert.equal(loaded.instances[0].tree.root.definition.name,'_root\\online\\019');
const stoppedTree=loaded.instances[0].tree;
const stopEvents:{kind:string;node:number}[]=[];
for(const node of stoppedTree.nodes) {
  const hooks=(node.lifecycle as unknown as {hooks:{end:()=>void;release:()=>void}}).hooks;
  const end=hooks.end,release=hooks.release;
  hooks.end=()=>{stopEvents.push({kind:'end',node:node.definition.index});end();};
  hooks.release=()=>{stopEvents.push({kind:'releaseEffect',node:node.definition.index});release();};
}
runtime.update(.05);assert.ok(scene.meshes.some(mesh=>mesh.metadata?.sourceNode===2470));
runtime.stopEffect(loaded.instances[0].handle);assert.deepEqual(stopEvents,native.nestedStop);
assert.equal(scene.meshes.length,0);
assert.equal(runtime.spawnWorldEffect('_root\\online\\004',[100000,0,0]),0);
const world=runtime.spawnWorldEffect('_root\\online\\004',[12.5,0,-4]);
assert.ok(world);assert.deepEqual(loaded.instances[0].tree.origin,[12.5,0,-4]);
assert.equal(loaded.instances[0].tree.parentMatrix,undefined);
runtime.stopEffect(world);assert.equal(loaded.instances.length,0);
root.setEnabled(false);runtime.resetRoleEffects(view);assert.equal(root.isEnabled(),true);
runtime.stopEffect(0);runtime.stopEffect(world);assert.equal(loaded.instances.length,0);
scene.dispose();engine.dispose();
console.log(`PASS: ${native.rows.length} native actor cases / production notification root, meshes, handles and cleanup`);
