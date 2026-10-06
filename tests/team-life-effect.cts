import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3, VertexBuffer} from '@babylonjs/core';
import type {SkillSoundCatalog} from '../apps/web/src/audio/effect-skill-sound';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {EFFECT_PRIMARY_TAGS} from '../apps/web/src/assets/tanks/effect-tag-matrices';
import {BattleSkillEffects} from '../apps/web/src/match/skills/battle-skill-effects';
import {createSkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-runtime';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

class AudioBoundary extends EventTarget {
  volume = 1;
  loop = false;
  paused = true;
  constructor(readonly src: string) {super();}
  play(): Promise<void> {this.paused = false; return Promise.resolve();}
  pause(): void {this.paused = true;}
}
function audioNode(): object {
  return {connect: () => {}, disconnect: () => {}, gain: {value: 1},
    positionX: {value: 0}, positionY: {value: 0}, positionZ: {value: 0},
    orientationX: {value: 0}, orientationY: {value: 0}, orientationZ: {value: 0}};
}
class AudioContextBoundary {
  state = 'running';
  close(): Promise<void> {this.state = 'closed'; return Promise.resolve();}
  destination = {};
  listener = Object.fromEntries(['position', 'forward', 'up'].flatMap(name =>
    ['X', 'Y', 'Z'].map(axis => [`${name}${axis}`, {value: 0}])));
  createGain(): object {return audioNode();}
  createPanner(): object {return audioNode();}
  createMediaElementSource(): object {return audioNode();}
}
const globals = ['Audio', 'AudioContext', 'window'].map(name =>
  ({name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name)}));
Object.defineProperty(globalThis, 'Audio', {value: AudioBoundary, configurable: true});
Object.defineProperty(globalThis, 'AudioContext', {value: AudioContextBoundary, configurable: true});
Object.defineProperty(globalThis, 'window', {value: {addEventListener: () => {}, removeEventListener: () => {}}, configurable: true});


const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
const native = JSON.parse(readFileSync('recovery/output/effect-tree-create-native.json', 'utf8')) as {
  rows: {node: number; retain: boolean; created: {node: number; retain: boolean}[]}[];
};
const source = (JSON.parse(readFileSync('recovery/output/verified/tables/skill.json', 'utf8')) as {
  rows: {values: Record<string, string>}[];
}).rows.find(row => row.values.SkillTableID === '501')!.values;
assert.deepEqual([source.Effect1, source.Sound1, source.EffectTag1, source.EffectMethod1], ['12', 'SE13', '0', '3']);
assert.deepEqual(catalog.skills.find(skill => skill.skillId === 501)!.effects[0],
  {effectId: 12, sound: 'SE13', tag: 0, method: 3});
assert.equal(EFFECT_PRIMARY_TAGS[0], 'tag_efcenter');
assert.equal(library.nodes[2461].name, '_root\\online\\012');
const nativeTree = native.rows.find(row => row.node === 2461 && !row.retain)!.created;
assert.deepEqual(nativeTree.map(row => row.node), [2461, 2561, 2600, 2609, 2610, 2611, 2612, 2613, 2614, 2615, 2616]);
const drawnNodes = [2561, 2600, 2609, 2611, 2612, 2613, 2614, 2615];
assert.deepEqual(nativeTree.filter(row => [1, 6, 7].includes(library.nodes[row.node].type)).map(row => row.node), drawnNodes);
assert.deepEqual(drawnNodes.map(node => library.nodes[node].type), [1, 1, 1, 7, 7, 7, 7, 7]);
const grids = library.textureGrids.filter(grid => drawnNodes.includes(grid.node));
assert.equal(grids.length, 8);
assert.ok(grids.every(grid => grid.resolution === 'published' && grid.asset));
for (const grid of grids) assert.ok(existsSync(`recovery/output/web-assets/${grid.asset}`));
const soundCatalog = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8')) as SkillSoundCatalog;
const se13 = soundCatalog.sounds.find(sound => sound.name === 'SE13')!;
assert.ok(se13 && existsSync(`recovery/output/web-assets/${se13.asset}`));
assert.equal(library.soundControls.find(row => row.node === 2616)!.reference, 'ww051');
assert.equal(soundCatalog.sounds.some(sound => sound.name.toLowerCase() === 'ww051'), false);
const missingSound = JSON.parse(readFileSync('recovery/output/ww051-loader-native.json', 'utf8')) as {
  loaderReached: boolean; descriptorValid: boolean; finished: boolean; stopReachedDevice: boolean;
};
assert.deepEqual([missingSound.loaderReached, missingSound.descriptorValid,
  missingSound.finished, missingSound.stopReachedDevice], [false, false, true, false]);

const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
camera.setTarget(Vector3.Zero());
camera.getViewMatrix(true);
camera.getProjectionMatrix(true);
const runtime = new EffectRuntime(scene, camera);
const loaded = runtime as unknown as {
  library: EffectRuntimeLibrary;
  textures: Map<string, RawTexture>;
  instances: {handle: number; tree: EffectRuntimeTree; draws: unknown[]}[];
};
loaded.library = library;
const audioOwners = runtime as unknown as {
  sound: {configure(catalog: SkillSoundCatalog): void; voices: Map<number, {audio?: AudioBoundary}>};
  skillSound: {configure(catalog: SkillSoundCatalog): void; voices: Map<number, {audio: AudioBoundary}>};
};
audioOwners.sound.configure(soundCatalog);
audioOwners.skillSound.configure(soundCatalog);
for (const asset of new Set(grids.map(grid => grid.asset))) {
  loaded.textures.set(asset, RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene));
}
const parent = [...EFFECT_IDENTITY];
const root = new TransformNode('actor', scene);
const view = {root, primaryTag: (name: string) => name === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
const sounds: {reference: string; selector: number}[] = [];
const playSound = runtime.playSkillSound.bind(runtime);
runtime.playSkillSound = (actor, reference, selector) => {
  sounds.push({reference, selector});
  return playSound(actor, reference, selector);
};
const notifications = createSkillEffectNotifications(runtime, catalog, {role: id => id === 47 ? view : undefined, localRole: () => view});
const battle = new BattleSkillEffects(notifications);
const play = (): void => battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P47', targetId: '',
  value: 0, x: 0, y: 0, z: 0,
  playSkillEffect: {skillId: 501, effectIndex: 0, duration: 0, roleId: 47, xBits: 0, zBits: 0}});
runtime.start();
play();
assert.deepEqual(sounds, [{reference: 'SE13', selector: 1}]);
assert.equal(notifications.records.length, 0);
const instance = loaded.instances[0];
assert.ok(instance.handle > 0);
assert.equal(instance.tree.parentMatrix, parent);
assert.equal(instance.draws.length, 8);
assert.equal(audioOwners.skillSound.voices.size, 1);
assert.ok([...audioOwners.skillSound.voices.values()].every(voice => voice.audio.src === `/${se13.asset}` && !voice.audio.loop));
assert.deepEqual(instance.tree.nodes.map(node => ({node: node.definition.index, retain: node.lifecycle.retainWhenEnded})), nativeTree);
runtime.update(.05);
const ring = scene.meshes.find(mesh => mesh.metadata?.sourceNode === 2561)!;
assert.ok(ring.isEnabled());
const before = [...ring.getVerticesData(VertexBuffer.PositionKind)!];
parent[12] = 20;
runtime.update(0);
const after = ring.getVerticesData(VertexBuffer.PositionKind)!;
for (let index = 0; index < 18; index += 3) {
  assert.ok(Math.abs(after[index] - before[index] + 20) < .00001, `tag_efcenter attachment ${index}: ${before[index]} -> ${after[index]}`);
}
const rendered = new Set<number>();
for (let tick = 0; tick < 400 && loaded.instances.length; ++tick) {
  runtime.update(.025);
  for (const mesh of scene.meshes) {
    if (mesh.isEnabled() && mesh.getTotalVertices() > 0) rendered.add(mesh.metadata.sourceNode);
  }
}
assert.deepEqual([...rendered].sort((a, b) => a - b), drawnNodes);
assert.equal(loaded.instances.length, 0, 'all skill501 effect nodes expire');
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.equal(audioOwners.sound.voices.size, 0);
for (const voice of audioOwners.skillSound.voices.values()) voice.audio.dispatchEvent(new Event('ended'));
assert.equal(audioOwners.skillSound.voices.size, 0);
play();
runtime.update(.1);
runtime.stopEffect(loaded.instances[0].handle);
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.equal(audioOwners.sound.voices.size, 0);
for (const voice of audioOwners.skillSound.voices.values()) voice.audio.dispatchEvent(new Event('ended'));
assert.equal(audioOwners.skillSound.voices.size, 0);
play();
runtime.update(.1);
runtime.detach(view);
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.equal(audioOwners.sound.voices.size, 0);
for (const voice of audioOwners.skillSound.voices.values()) voice.audio.dispatchEvent(new Event('ended'));
assert.equal(audioOwners.skillSound.voices.size, 0);
play();
runtime.update(.1);
runtime.stop();
assert.equal(audioOwners.skillSound.voices.size, 0);
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.equal(audioOwners.sound.voices.size, 0);
const evidence = {status: 'PASS', skill: 501, effect: 12, sound: 'SE13', selector: 1,
  tag: 'tag_efcenter', method: 3, sourceNodes: nativeTree,
  renderedNodes: [...rendered].sort((a, b) => a - b), audioAsset: se13.asset,
  liveAttachment: true, naturalExpiry: true, explicitStop: true, detach: true, runtimeStop: true,
  missingResources: [{node: 2616, reference: 'ww051', behavior: 'Original source absent: invalid playback, finished=true, stop returns without device playback',
    evidence: 'recovery/output/ww051-loader-native.json',
    minimumEntry: 'Restore the original data/sound/ww051.wav and publish its existing catalog reference'}],
  scope: 'Production notification, runtime tree, geometry and sound selection; fixture textures and WebAudio boundaries. Device playback and exact pixels require browser evidence.'};
writeFileSync('recovery/output/team-life-effect.json', `${JSON.stringify(evidence, null, 2)}\n`);
scene.dispose(); engine.dispose();
for (const {name, descriptor} of globals) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}
console.log('PASS: skill501 Effect12/SE13 original tree, eight draw nodes, live tag_efcenter and release');
