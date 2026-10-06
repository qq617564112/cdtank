import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3, VertexBuffer} from '@babylonjs/core';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {EFFECT_PRIMARY_TAGS} from '../apps/web/src/assets/tanks/effect-tag-matrices';
import {BattleSkillEffects} from '../apps/web/src/match/skills/battle-skill-effects';
import {createSkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-runtime';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
const native = JSON.parse(readFileSync('recovery/output/effect-tree-create-native.json', 'utf8')) as {
  rows: {node: number; retain: boolean; created: {node: number; retain: boolean}[]}[];
};
assert.equal(catalog.items.find(item => item.itemTableId === 4)!.skillIds[0], 4);
assert.deepEqual(catalog.skills.find(skill => skill.skillId === 4)!.effects[0],
  {effectId: 106, sound: 'SE38', tag: 0, method: 3});
assert.equal(EFFECT_PRIMARY_TAGS[0], 'tag_efcenter');
const nativeTree = native.rows.find(row => row.node === 2907 && !row.retain)!.created;
assert.deepEqual(nativeTree.map(row => row.node),
  [2907, 2908, 2909, 2910, 2911, 2912, 2913, 2914, 2915, 2916, 3103]);
assert.equal(library.nodes[2915].type, 4);
const embeddedSound = library.soundControls.find(control => control.node === 2915)!;
assert.equal(embeddedSound.reference, 'ww051');
const drawnNodes = [2908, 2909, 2910, 2912, 2913, 2914, 3103];
assert.deepEqual(nativeTree.filter(row => [1, 7].includes(library.nodes[row.node].type)).map(row => row.node), drawnNodes);
assert.deepEqual(drawnNodes.map(node => library.nodes[node].type), [1, 1, 1, 7, 7, 7, 1]);
const grids = library.textureGrids.filter(grid => drawnNodes.includes(grid.node));
assert.equal(grids.length, 7);
assert.ok(grids.every(grid => grid.resolution === 'published' && grid.asset));
for (const grid of grids) assert.ok(existsSync(`recovery/output/web-assets/${grid.asset}`), grid.asset);
const audio = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8')) as {
  sounds: {name: string; asset: string}[];
};
const soundAsset = audio.sounds.find(sound => sound.name === 'SE38')!.asset;
assert.equal(soundAsset, 'audio/sound/SE38.wav');
assert.ok(existsSync(`recovery/output/web-assets/${soundAsset}`));

const embeddedSoundAsset = audio.sounds.find(sound =>
  sound.name.toLowerCase() === embeddedSound.reference.toLowerCase())?.asset;

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
  playSkillEffect: {skillId: 4, effectIndex: 0, duration: 0, roleId: 47, xBits: 0, zBits: 0}});
runtime.start();
play();
assert.deepEqual(sounds, [{reference: 'SE38', selector: 1}]);
assert.equal(notifications.records.length, 0);
const instance = loaded.instances[0];
assert.ok(instance.handle > 0);
assert.equal(instance.tree.parentMatrix, parent);
assert.equal(instance.draws.length, 7);
assert.deepEqual(instance.tree.nodes.map(node => ({node: node.definition.index, retain: node.lifecycle.retainWhenEnded})), nativeTree);
runtime.update(.05);
const ring = scene.meshes.find(mesh => mesh.metadata?.sourceNode === 2908)!;
assert.ok(ring.isEnabled());
const before = [...ring.getVerticesData(VertexBuffer.PositionKind)!];
parent[12] = 20;
runtime.update(0);
const after = ring.getVerticesData(VertexBuffer.PositionKind)!;
for (let index = 0; index < 18; index += 3) {
  assert.ok(Math.abs(after[index] - before[index] + 20) < .00001, `tag_efcenter attachment ${index}: ${before[index]} -> ${after[index]}`);
}
const rendered = new Set<number>();
for (let tick = 0; tick < 200 && loaded.instances.length; ++tick) {
  runtime.update(.025);
  for (const mesh of scene.meshes) {
    if (mesh.isEnabled() && mesh.getTotalVertices() > 0) rendered.add(mesh.metadata.sourceNode);
  }
}
assert.deepEqual([...rendered].sort((a, b) => a - b), drawnNodes);
assert.equal(loaded.instances.length, 0, 'all attack-drink effect nodes expire');
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
play();
runtime.update(.1);
runtime.stopEffect(loaded.instances[0].handle);
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
play();
runtime.update(.1);
runtime.detach(view);
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
play();
runtime.update(.1);
runtime.stop();
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.deepEqual(sounds, Array.from({length: 4}, () => ({reference: 'SE38', selector: 1})));
const evidence = {item: 4, skill: 4, effect: 106, sound: 'SE38', tag: 'tag_efcenter', method: 3,
  soundAsset, embeddedSound: {node: 2915, reference: embeddedSound.reference,
    asset: embeddedSoundAsset ?? null, resolved: Boolean(embeddedSoundAsset)}, sourceNodes: nativeTree, textureAssets: [...new Set(grids.map(grid => grid.asset))], renderedNodes: [...rendered].sort((a, b) => a - b),
  liveAttachment: true, naturalExpiry: true, explicitStop: true, detach: true, runtimeStop: true,
  scope: 'Production notification/runtime tree and submitted geometry with NullEngine fixture textures. Actual audio playback and original pixels require browser evidence.'};
writeFileSync('recovery/output/attack-drink-effect-fidelity.json', `${JSON.stringify(evidence, null, 2)}\n`);
scene.dispose();
engine.dispose();
console.log('PASS: item4/skill4 Effect106 native subtree, seven actual geometry submissions, live tag_efcenter, SE38 one-shot dispatch, expiry/stop/detach/clear');
