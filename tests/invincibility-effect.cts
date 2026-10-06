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

interface Created {node: number; retain: boolean;}
interface NativeTree {node: number; retain: boolean; created: Created[];}
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
const native = JSON.parse(readFileSync('recovery/output/effect-tree-create-native.json', 'utf8')) as {rows: NativeTree[]};
assert.equal(catalog.items.find(item => item.itemTableId === 8)!.skillIds[0], 8);
const skill = catalog.skills.find(skill => skill.skillId === 8)!;
assert.deepEqual(skill.effects[0], {effectId: 100, sound: '0', tag: 0, method: 3});
assert.deepEqual(skill.functions[0], {type: 6, t: 10, x: 0, y: 0, z: 0});
assert.equal(EFFECT_PRIMARY_TAGS[0], 'tag_efcenter');
const source = native.rows.find(row => row.node === 2992 && !row.retain)!;
const retainedSource = native.rows.find(row => row.node === 2992 && row.retain)!;
const sourceNodes = [2992, 2993, 2994, 2995, 2996];
const drawnNodes = sourceNodes.slice(1);
assert.deepEqual(source.created.map(row => row.node), sourceNodes);
assert.deepEqual(retainedSource.created, sourceNodes.map(node => ({node, retain: true})));
assert.equal(library.nodes[2992].name, '_root\\online\\100');
assert.deepEqual(drawnNodes.map(node => library.nodes[node].type), [7, 7, 7, 7]);
assert.ok(library.nodeTimings.filter(row => sourceNodes.includes(row.node)).every(row => row.lifetime === 0));
assert.deepEqual(library.soundControls.filter(row => sourceNodes.includes(row.node)), []);
assert.ok(sourceNodes.every(node => library.nodes[node].type !== 4), 'Effect100 has no embedded type4 audio');
const grids = library.textureGrids.filter(grid => drawnNodes.includes(grid.node));
assert.equal(grids.length, 4);
assert.ok(grids.every(grid => grid.resolution === 'published' && grid.asset));
for (const grid of grids) assert.ok(existsSync(`recovery/output/web-assets/${grid.asset}`), grid.asset);
const audio = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8')) as {sounds: {name: string}[]};
assert.ok(!audio.sounds.some(sound => sound.name === '0'));

const engine = new NullEngine();
const scene = new Scene(engine);
try {
  const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
  camera.setTarget(Vector3.Zero());
  camera.getViewMatrix(true);
  camera.getProjectionMatrix(true);
  const runtime = new EffectRuntime(scene, camera);
  const loaded = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
    instances: {handle: number; tree: EffectRuntimeTree; draws: unknown[]}[];
    skillSound: {voices: Map<number, unknown>}; sound: {voices: Map<number, unknown>}};
  loaded.library = library;
  for (const asset of new Set(grids.map(grid => grid.asset))) {
    loaded.textures.set(asset, RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene));
  }
  const parent = [...EFFECT_IDENTITY];
  const root = new TransformNode('actor', scene);
  const view = {root, primaryTag: (name: string) => name === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
  const otherParent = [...EFFECT_IDENTITY];
  const otherView = {root: new TransformNode('other-actor', scene),
    primaryTag: (name: string) => name === 'tag_efcenter' ? otherParent : undefined} as unknown as TankView;
  const sounds: {reference: string; selector: number; handle: number}[] = [];
  const playSound = runtime.playSkillSound.bind(runtime);
  runtime.playSkillSound = (actor, reference, selector) => {
    const handle = playSound(actor, reference, selector);
    sounds.push({reference, selector, handle});
    return handle;
  };
  const notifications = createSkillEffectNotifications(runtime, catalog,
    {role: id => id === 47 ? view : id === 48 ? otherView : undefined, localRole: () => view});
  const battle = new BattleSkillEffects(notifications);
  const play = (roleId = 47): void => battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: `P${roleId}`, targetId: '',
    value: 0, x: 0, y: 0, z: 0,
    playSkillEffect: {skillId: 8, effectIndex: 0, duration: 10, roleId, xBits: 0, zBits: 0}});
  const clean = (): void => {
    assert.equal(notifications.records.length, 0);
    assert.equal(loaded.instances.length, 0);
    assert.equal(scene.meshes.length, 0);
    assert.equal(scene.materials.length, 0);
    assert.equal(loaded.skillSound.voices.size, 0);
    assert.equal(loaded.sound.voices.size, 0);
  };
  runtime.start();
  play();
  assert.equal(notifications.records.length, 1);
  assert.equal(notifications.records[0].duration, 10);
  assert.equal(notifications.records[0].effect, loaded.instances[0].handle);
  assert.equal(notifications.records[0].sound, 0);
  assert.equal(notifications.queueTimers.size, 0);
  const instance = loaded.instances[0];
  assert.equal(instance.tree.parentMatrix, parent);
  assert.equal(instance.draws.length, 4);
  // Native actor attachment retains the notification handle, while manager-created nodes use retain=false.
  assert.deepEqual(instance.tree.nodes.map(node => ({node: node.definition.index, retain: node.lifecycle.retainWhenEnded})), source.created);
  play();
  assert.equal(loaded.instances.length, 1, 'duplicate retained notification does not create a second tree');
  assert.equal(sounds.length, 1);
  runtime.update(.25);
  const rendered = scene.meshes.filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
  assert.deepEqual(rendered.map(mesh => mesh.metadata.sourceNode).sort((a, b) => a - b), drawnNodes);
  const before = rendered.map(mesh => [...mesh.getVerticesData(VertexBuffer.PositionKind)!]);
  parent[12] = 20;
  runtime.update(0);
  for (let meshIndex = 0; meshIndex < rendered.length; ++meshIndex) {
    const after = rendered[meshIndex].getVerticesData(VertexBuffer.PositionKind)!;
    for (let vertex = 0; vertex < after.length; vertex += 3) {
      assert.ok(Math.abs(after[vertex] - before[meshIndex][vertex] + 20) < .0001,
        `live tag_efcenter node${rendered[meshIndex].metadata.sourceNode} vertex${vertex / 3}`);
    }
  }
  for (let second = 0; second < 20; ++second) runtime.update(1);
  assert.equal(loaded.instances[0].handle, instance.handle, 'zero-lifetime tree remains active until a notification stops it');
  assert.equal(notifications.records[0].duration, 10, 'render delta does not replace the original simulation counter');
  notifications.update(29);
  assert.equal(notifications.records[0].duration, 10);
  notifications.update(1);
  assert.equal(notifications.records[0].duration, 9);
  for (let second = 0; second < 8; ++second) notifications.update(30);
  assert.equal(notifications.records[0].duration, 1);
  notifications.update(29);
  assert.equal(loaded.instances.length, 1);
  notifications.update(1);
  clean();

  play();
  runtime.update(.25);
  battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P47', targetId: '', value: 0, x: 0, y: 0, z: 0,
    stopSkillEffect: {skillId: 8, roleId: 47}});
  clean();
  play();
  runtime.update(.25);
  battle.remove('P47');
  clean();
  play();
  runtime.update(.25);
  battle.clear();
  clean();
  play();
  runtime.update(.25);
  battle.frame(10, 0);
  assert.equal(notifications.records[0].duration, 10, 'real-time queued timer cannot expire retained skill8');
  battle.clear();
  play();
  play(48);
  runtime.update(.25);
  assert.deepEqual(notifications.records.map(record => record.roleId), [47, 48]);
  assert.equal(loaded.instances.length, 2);
  const otherInstance = loaded.instances[1];
  assert.notEqual(loaded.instances[0].handle, otherInstance.handle);
  assert.equal(otherInstance.tree.parentMatrix, otherParent);
  const otherMeshes = scene.meshes.slice(4);
  assert.equal(scene.meshes.length, 8);
  assert.equal(otherMeshes.length, 4);
  battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P47', targetId: '', value: 0, x: 0, y: 0, z: 0,
    stopSkillEffect: {skillId: 8, roleId: 47}});
  assert.deepEqual(notifications.records.map(record => ({roleId: record.roleId, effect: record.effect, duration: record.duration})),
    [{roleId: 48, effect: otherInstance.handle, duration: 10}]);
  assert.equal(loaded.instances.length, 1);
  assert.equal(loaded.instances[0], otherInstance);
  assert.deepEqual(scene.meshes, otherMeshes, 'Stop8 preserves the other role\'s exact geometry');
  runtime.update(.25);
  assert.ok(otherMeshes.every(mesh => !mesh.isDisposed() && mesh.isEnabled() && mesh.getTotalVertices() > 0));
  assert.ok(otherInstance.tree.nodes.every(node => node.lifecycle.phase === 2));
  battle.clear();
  clean();
  runtime.stop();
  clean();
  assert.deepEqual(sounds, Array.from({length: 7}, () => ({reference: '0', selector: -1, handle: 0})));
  writeFileSync('recovery/output/invincibility-effect.json', `${JSON.stringify({status: 'PASS', item: 8, skill: 8,
    effect: 100, sound: '0', embeddedType4Audio: [], tag: 'tag_efcenter', method: 3,
    sourceNodes: source.created, retainedFixtureNodes: retainedSource.created,
    textureAssets: [...new Set(grids.map(grid => grid.asset))], renderedNodes: drawnNodes,
    retainedNotification: true, nodeLifetime: 0, duration: 10, simulationStepsPerCounterSecond: 30,
    liveAttachment: true, explicitStop: true, roleDeparture: true, battleClear: true,
    overlappingRoles: {roleIds: [47, 48], stoppedRoleId: 47, survivingRoleId: 48,
      retainedRecordPreserved: true, actualInstancePreserved: true, submittedGeometryPreserved: true},
    serverFunction6: 'Original server implementation unknown; published type6/t10 defines duration only.',
    scope: 'Production BattleSkillEffects/SkillEffectNotifications and EffectRuntime tree/geometry. NullEngine uses fixture textures; browser evidence establishes published pixels. Skill8 countdown uses simulation steps, and server elapsed expiry sends StopSkillEffect.'}, null, 2)}\n`);
  console.log('PASS: skill8 Effect100 native tree/four submitted strips, live tag, no audio, retained 300-step expiry, Stop/role departure/battle clear');
} finally {
  scene.dispose();
  engine.dispose();
}
