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
assert.equal(catalog.items.find(item => item.itemTableId === 5)!.skillIds[0], 5);
assert.deepEqual(catalog.skills.find(skill => skill.skillId === 5)!.effects[0],
  {effectId: 108, sound: 'SE40', tag: 0, method: 3});
assert.deepEqual(catalog.skills.find(skill => skill.skillId === 5)!.effects[1],
  {effectId: 10, sound: 'SE02', tag: 0, method: 3});

const sourceTable = (name: string): Record<string, string>[] =>
  (JSON.parse(readFileSync(`recovery/output/verified/tables/${name}.json`, 'utf8')) as {
    rows: {values: Record<string, string>}[];
  }).rows.map(row => row.values);
const sourceItem = sourceTable('item').find(row => row.ItemTableID === '5')!;
const sourceSkill = sourceTable('skill').find(row => row.SkillTableID === '5')!;
assert.equal(sourceItem.ItemSkill1, '5');
assert.deepEqual([sourceSkill.Effect1, sourceSkill.Sound1, sourceSkill.EffectTag1, sourceSkill.EffectMethod1],
  ['108', 'SE40', '0', '3']);
assert.deepEqual([sourceSkill.Effect2, sourceSkill.Sound2, sourceSkill.EffectTag2, sourceSkill.EffectMethod2],
  ['10', 'SE02', '0', '3']);
assert.equal(library.nodes[2917].name, '_root\\online\\108');
assert.equal(EFFECT_PRIMARY_TAGS[0], 'tag_efcenter');
const nativeTree = native.rows.find(row => row.node === 2917 && !row.retain)!.created;
assert.deepEqual(nativeTree.map(row => row.node),
  [2917, 2918, 2919, 2920, 2921, 2922, 2923, 2924, 2925, 2926, 3106]);
// Compare each selected export record directly with the original effect.sav bytes.
const originalLibrary = readFileSync('recovery/output/verified/assets/data/Data/effect/effect.sav');
const uint = (value: number): Buffer => {
  const result = Buffer.alloc(4);
  result.writeUInt32LE(value);
  return result;
};
const block = (hex: string): Buffer => {
  const bytes = Buffer.from(hex, 'hex');
  return Buffer.concat([uint(bytes.length), bytes]);
};
for (const row of nativeTree) {
  const node = library.nodes[row.node] as typeof library.nodes[number] & {
    offset: number; size: number; nameField: string; fields: string; resource: string;
    modifiers: {base: string; payload: string}[];
  };
  const record = Buffer.concat([
    uint(node.type), uint(node.id), Buffer.from(node.nameField, 'hex'), Buffer.from(node.fields, 'hex'),
    block(node.resource), uint(node.modifiers.length),
    ...node.modifiers.flatMap(modifier => [block(modifier.base),
      ...([1, 5, 6, 7, 8, 9].includes(node.type) ? [block(modifier.payload)] : [])]),
    uint(node.children.length), ...node.children.map(uint),
  ]);
  assert.equal(record.length, node.size);
  assert.deepEqual(record, originalLibrary.subarray(node.offset, node.offset + node.size),
    `Effect108 original node ${node.index}`);
}
assert.equal(library.nodes[2925].type, 4);
const embeddedSound = library.soundControls.find(control => control.node === 2925)!;
assert.equal(embeddedSound.reference, 'ww051');
const drawnNodes = [2918, 2919, 2920, 2922, 2923, 2924, 3106];
assert.deepEqual(nativeTree.filter(row => [1, 7].includes(library.nodes[row.node].type)).map(row => row.node), drawnNodes);
assert.deepEqual(drawnNodes.map(node => library.nodes[node].type), [1, 1, 1, 7, 7, 7, 1]);
const grids = library.textureGrids.filter(grid => drawnNodes.includes(grid.node));
assert.equal(grids.length, 7);
assert.deepEqual([...new Set(grids.map(grid => grid.asset))], [
  'Data/effect/effect/go.png', 'Data/effect/effect/FlareBrightOrange_BLUE.png',
  'Data/effect/effect/huoguang_blue.png', 'Data/effect/xy/108.png',
]);
const stripControls = library.stripControls.filter(control => [2922, 2923, 2924].includes(control.node));
assert.equal(stripControls.length, 3);
assert.deepEqual(stripControls.map(control => control.color), Array.from({length: 3}, () => [0.5, 1, 1, 0.800000011920929]));
assert.equal(library.spriteControls.filter(control => control.node === 3106).length, 8);
assert.ok(grids.every(grid => grid.resolution === 'published' && grid.asset));
for (const grid of grids) assert.ok(existsSync(`recovery/output/web-assets/${grid.asset}`), grid.asset);
const audio = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8')) as {
  sounds: {name: string; asset: string}[];
};
const soundAsset = audio.sounds.find(sound => sound.name === 'SE40')!.asset;
assert.equal(soundAsset, 'audio/sound/SE40.wav');
assert.ok(existsSync(`recovery/output/web-assets/${soundAsset}`));

const embeddedSoundAsset = audio.sounds.find(sound =>
  sound.name.toLowerCase() === embeddedSound.reference.toLowerCase())?.asset;
assert.equal(embeddedSoundAsset, undefined);
const archiveEvidence = ['data', 'music'].map(name => {
  const manifest = JSON.parse(readFileSync(`recovery/output/verified/manifests/${name}.json`, 'utf8')) as {
    files: number; entries: {path: string}[];
  };
  const matches = manifest.entries.filter(entry => entry.path.toLowerCase().includes('ww051'));
  assert.deepEqual(matches, []);
  return {manifest: name, files: manifest.files, matchingReferences: matches.length};
});
const missingSoundNative = JSON.parse(readFileSync('recovery/output/ww051-loader-native.json', 'utf8'));
assert.equal(missingSoundNative.reference, embeddedSound.reference);
assert.equal(missingSoundNative.descriptorValid, false);
assert.equal(missingSoundNative.finished, true);
assert.equal(missingSoundNative.stopReachedDevice, false);

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
  sound: {configure(catalog: unknown): void; voices: Map<number, unknown>};
  skillSound: {voices: Map<number, unknown>};
};
loaded.library = library;
loaded.sound.configure(audio);
for (const asset of new Set(grids.map(grid => grid.asset))) {
  loaded.textures.set(asset, RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene));
}
const parent = [...EFFECT_IDENTITY];
const root = new TransformNode('actor', scene);
const view = {root, primaryTag: (name: string) => name === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
const otherParent = [...EFFECT_IDENTITY];
const otherView = {root: new TransformNode('other-actor', scene),
  primaryTag: (name: string) => name === 'tag_efcenter' ? otherParent : undefined} as unknown as TankView;
const sounds: {reference: string; selector: number}[] = [];
const playSound = runtime.playSkillSound.bind(runtime);
runtime.playSkillSound = (actor, reference, selector) => {
  sounds.push({reference, selector});
  return playSound(actor, reference, selector);
};
const notifications = createSkillEffectNotifications(runtime, catalog, {role: id => id === 47 ? view : id === 48 ? otherView : undefined, localRole: () => view});
const battle = new BattleSkillEffects(notifications);
const play = (roleId = 47): void => battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: `P${roleId}`, targetId: '',
  value: 0, x: 0, y: 0, z: 0,
  playSkillEffect: {skillId: 5, effectIndex: 0, duration: 0, roleId, xBits: 0, zBits: 0}});
runtime.start();
play();
assert.deepEqual(sounds, [{reference: 'SE40', selector: 1}]);
assert.equal(notifications.records.length, 0);
const instance = loaded.instances[0];
assert.ok(instance.handle > 0);
assert.equal(instance.tree.parentMatrix, parent);
assert.equal(instance.draws.length, 7);
assert.equal(loaded.sound.voices.size, 0, 'native missing ww051 finishes without media playback');
assert.deepEqual(instance.tree.nodes.map(node => ({node: node.definition.index, retain: node.lifecycle.retainWhenEnded})), nativeTree);
runtime.update(.05);
const missingSound = instance.tree.nodes.find(node => node.definition.index === 2925)!.sound!;
assert.equal(missingSound.started, true);
assert.equal(missingSound.backend.finished(missingSound.handle!), true);
assert.equal(loaded.sound.voices.size, 0);
const ring = scene.meshes.find(mesh => mesh.metadata?.sourceNode === 2918)!;
assert.ok(ring.isEnabled());
const before = [...ring.getVerticesData(VertexBuffer.PositionKind)!];
parent[12] = 20;
runtime.update(0);
const after = ring.getVerticesData(VertexBuffer.PositionKind)!;
for (let index = 0; index < 18; index += 3) {
  assert.ok(Math.abs(after[index] - before[index] + 20) < .00001, `tag_efcenter attachment ${index}: ${before[index]} -> ${after[index]}`);
}
const rendered = new Set<number>();
let naturalLifetimeSeconds = .05;
for (let tick = 0; tick < 200 && loaded.instances.length; ++tick) {
  runtime.update(.025);
  naturalLifetimeSeconds += .025;
  for (const mesh of scene.meshes) {
    if (mesh.isEnabled() && mesh.getTotalVertices() > 0) rendered.add(mesh.metadata.sourceNode);
  }
}
assert.deepEqual([...rendered].sort((a, b) => a - b), drawnNodes);
assert.equal(loaded.instances.length, 0, 'all defense-drink effect nodes expire');
assert.ok(naturalLifetimeSeconds < 10, '首槽动画期限独立于十秒属性期限');
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.equal(loaded.sound.voices.size, 0);
assert.equal(loaded.skillSound.voices.size, 0);
play();
runtime.update(.1);
runtime.stopEffect(loaded.instances[0].handle);
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.equal(loaded.sound.voices.size, 0);
assert.equal(loaded.skillSound.voices.size, 0);
play();
runtime.update(.1);
runtime.detach(view);
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.equal(loaded.sound.voices.size, 0);
assert.equal(loaded.skillSound.voices.size, 0);
const overlappingRoles: {cleanup: string; roleIds: number[]; stoppedRoleId: number; survivingRoleId: number;
  notificationRecords: number; actualInstancePreserved: boolean; submittedGeometryPreserved: boolean;
  naturalExpiry: boolean}[] = [];
for (const cleanup of ['explicitStop', 'detach']) {
  play();
  play(48);
  runtime.update(.25);
  assert.equal(notifications.records.length, 0, 'skill5 one-shot notifications retain no records');
  assert.equal(loaded.instances.length, 2);
  const firstInstance = loaded.instances[0];
  const otherInstance = loaded.instances[1];
  assert.notEqual(firstInstance.handle, otherInstance.handle);
  assert.equal(otherInstance.tree.parentMatrix, otherParent);
  assert.equal(firstInstance.draws.length, 7);
  assert.equal(otherInstance.draws.length, 7);
  assert.equal(scene.meshes.length, 14);
  const otherMeshes = scene.meshes.slice(7);
  assert.deepEqual(otherMeshes.map(mesh => mesh.metadata.sourceNode).sort((a, b) => a - b), drawnNodes);
  if (cleanup === 'explicitStop') runtime.stopEffect(firstInstance.handle);
  else runtime.detach(view);
  assert.equal(notifications.records.length, 0);
  assert.deepEqual(loaded.instances, [otherInstance]);
  assert.deepEqual(scene.meshes, otherMeshes, "first role cleanup preserves the other role's exact geometry");
  runtime.update(.025);
  assert.ok(otherMeshes.every(mesh => !mesh.isDisposed() && mesh.isEnabled() && mesh.getTotalVertices() > 0));
  assert.equal(otherInstance.tree.parentMatrix, otherParent);
  for (let tick = 0; tick < 200 && loaded.instances.length; ++tick) runtime.update(.025);
  assert.equal(notifications.records.length, 0);
  assert.equal(loaded.instances.length, 0);
  assert.equal(scene.meshes.length, 0);
  assert.equal(scene.materials.length, 0);
  assert.equal(loaded.sound.voices.size, 0);
  assert.equal(loaded.skillSound.voices.size, 0);
  overlappingRoles.push({cleanup, roleIds: [47, 48], stoppedRoleId: 47, survivingRoleId: 48,
    notificationRecords: 0, actualInstancePreserved: true, submittedGeometryPreserved: true, naturalExpiry: true});
}
play();
runtime.update(.1);
runtime.stop();
assert.equal(loaded.instances.length, 0);
assert.equal(scene.meshes.length, 0);
assert.equal(scene.materials.length, 0);
assert.equal(loaded.sound.voices.size, 0);
assert.equal(loaded.skillSound.voices.size, 0);
assert.deepEqual(sounds, Array.from({length: 8}, () => ({reference: 'SE40', selector: 1})));
const evidence = {status: 'PASS', item: 5, skill: 5, effect: 108, sound: 'SE40', tag: 'tag_efcenter', method: 3,
  soundAsset, embeddedSound: {node: 2925, reference: embeddedSound.reference,
    asset: embeddedSoundAsset ?? null, resolved: Boolean(embeddedSoundAsset), archiveEvidence,
    nativeMissingDescriptor: true, nativeMissingFinished: true, nativeMissingStopNoDevice: true,
    runtimeStarted: missingSound.started, runtimeFinished: missingSound.backend.finished(missingSound.handle!)}, sourceNodes: nativeTree, textureAssets: [...new Set(grids.map(grid => grid.asset))], renderedNodes: [...rendered].sort((a, b) => a - b),
  secondSlot: {effect: 10, sound: 'SE02', trigger: 'unknown'},
  sourceLibrary: {path: 'Data/effect/effect.sav', exactRecords: nativeTree.length},
  sourceTables: {itemSkill1: sourceItem.ItemSkill1, effect1: sourceSkill.Effect1, sound1: sourceSkill.Sound1},
  overlappingRoles,
  liveAttachment: true, naturalExpiry: true, naturalLifetimeSeconds,
  notificationDuration: 0, notificationRecords: 0, explicitStop: true, detach: true, runtimeStop: true,
  scope: 'Production notification/runtime tree and submitted geometry with NullEngine fixture textures. Actual audio playback and original pixels require browser evidence.'};
writeFileSync('recovery/output/defense-drink-effect-fidelity.json', `${JSON.stringify(evidence, null, 2)}\n`);
scene.dispose();
engine.dispose();
console.log('PASS: item5/skill5 Effect108 native subtree, seven actual geometry submissions, live tag_efcenter, SE40 one-shot dispatch, expiry/stop/detach/clear');
