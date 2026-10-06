import assert from 'node:assert/strict';
import {Mesh, MeshBuilder, NullEngine, Scene, StandardMaterial} from '@babylonjs/core';
import type {MsgRoomSnapshot, ObjectiveSnapshot, PlayerSnapshot} from '../apps/shared/protocols';
import {BattleTargets} from '../apps/web/src/render/battle-targets';

const engine = new NullEngine();
const scene = new Scene(engine);
const placement = MeshBuilder.CreateBox('original-placement', {size: 12}, scene);
const placementMaterial = new StandardMaterial('original-placement-material', scene);
placement.material = placementMaterial;
// Babylon lazily creates its shared default material when geometry is added.
void scene.defaultMaterial;
const baselineMeshes = [...scene.meshes];
const baselineMaterials = [...scene.materials];
const targets = new BattleTargets(scene);
const capture: ObjectiveSnapshot = {id: 'capture', kind: 'CAPTURE', x: 12, y: 4, z: -30,
  radius: 24, hp: 1, maxHp: 1, ownerTeam: -1, contested: false};
const destroy: ObjectiveSnapshot = {id: 'destroy', kind: 'DESTROY', x: -25, y: 8, z: 90,
  radius: 10, hp: 100, maxHp: 100, ownerTeam: 1, contested: false};
const source: ObjectiveSnapshot = {...destroy, id: 'source', sourcePlacementId: 'original-placement'};
const vip: PlayerSnapshot = {id: 'captain', name: 'Captain', tankId: 1, team: 0,
  x: 40, y: 10, z: -15, yaw: 0, aim: 0, hp: 100, maxHp: 100, alive: true,
  score: 0, kills: 0, deaths: 0, respawnAt: 0, isVIP: true};
function snapshot(objectives: ObjectiveSnapshot[], players: PlayerSnapshot[] = []): MsgRoomSnapshot {
  return {roomId: 'match-targets', mode: 8, serverTime: 1000, tick: 20, remaining: 180,
    phase: 'PLAYING', players, bullets: [], teamScores: [0, 0], winnerTeam: -1,
    match: {round: 1, readyPlayerIds: [], rematchPlayerIds: [], minPlayers: 2,
      targetScore: 10, teamLives: [], objectives}};
}
function mesh(name: string): Mesh {
  const result = scene.getMeshByName(name);
  assert.ok(result instanceof Mesh, `missing actual scene mesh ${name}`);
  assert.ok(result.getTotalVertices() > 0, `${name} has real geometry`);
  assert.equal(result.isPickable, false);
  return result;
}
function material(mesh: Mesh): StandardMaterial {
  assert.ok(mesh.material instanceof StandardMaterial);
  return mesh.material;
}
function color(actual: readonly number[], expected: readonly number[]): void {
  expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) < 1e-6));
}
function baseline(): void {
  assert.deepEqual(scene.meshes, baselineMeshes);
  assert.deepEqual(scene.materials, baselineMaterials);
  assert.equal(placement.isDisposed(), false);
  assert.equal(placement.material, placementMaterial);
}

targets.update(snapshot([capture, destroy, source], [vip]));
const captureMesh = mesh('objective-capture');
const destroyMesh = mesh('objective-destroy');
const vipMesh = mesh('VIP-captain');
assert.deepEqual(captureMesh.position.asArray(), [-12, 5, -30]);
assert.deepEqual(destroyMesh.position.asArray(), [25, 28, 90]);
assert.deepEqual(vipMesh.position.asArray(), [-40, 85, -15]);
assert.equal(material(captureMesh).alpha, .45);
assert.equal(material(destroyMesh).alpha, 1);
color(material(captureMesh).diffuseColor.asArray(), [1, .8, .2]);
color(material(destroyMesh).diffuseColor.asArray(), [1, .5, .2]);
color(material(vipMesh).emissiveColor.asArray(), [1, .85, .15]);
assert.equal(scene.getMeshByName('objective-source'), null);
assert.equal(scene.meshes.length, baselineMeshes.length + 3);
assert.equal(scene.materials.length, baselineMaterials.length + 3);
const size = captureMesh.getBoundingInfo().boundingBox.extendSize.scale(2);
color(size.asArray(), [48, 1, 48]);
const destroySize = destroyMesh.getBoundingInfo().boundingBox.extendSize.scale(2);
assert.ok(destroySize.x > 19 && destroySize.y === 20 && destroySize.z > 19);

// Repeated authoritative snapshots retain the actual render resources.
const existingMeshes = [...scene.meshes];
const existingMaterials = [...scene.materials];
for (let index = 0; index < 3; ++index) targets.update(snapshot([capture, destroy, source], [vip]));
assert.deepEqual(scene.meshes, existingMeshes);
assert.deepEqual(scene.materials, existingMaterials);
for (const [ownerTeam, contested, expected] of [
  [0, false, [.3, .7, 1]], [1, false, [1, .5, .2]], [-1, false, [1, .8, .2]],
  [0, true, [1, .2, .2]], [1, true, [1, .2, .2]],
] as const) {
  targets.update(snapshot([{...capture, ownerTeam, contested, x: -60, y: 15, z: 70}, destroy, source],
    [{...vip, x: -80, y: 25, z: 42}]));
  assert.equal(scene.getMeshByName('objective-capture'), captureMesh);
  assert.deepEqual(captureMesh.position.asArray(), [60, 16, 70]);
  assert.deepEqual(vipMesh.position.asArray(), [80, 100, 42]);
  color(material(captureMesh).diffuseColor.asArray(), expected);
  color(material(captureMesh).emissiveColor.asArray(), expected.map(value => value * .35));
}
const destroyMaterial = material(destroyMesh);
const vipMaterial = material(vipMesh);
targets.update(snapshot([capture, {...destroy, hp: 0}, source], [{...vip, hp: 0, alive: false}]));
assert.equal(destroyMesh.isDisposed(), true);
assert.equal(vipMesh.isDisposed(), true);
assert.equal(scene.materials.includes(destroyMaterial), false);
assert.equal(scene.materials.includes(vipMaterial), false);
assert.equal(scene.getMeshByName('objective-destroy'), null);
assert.equal(scene.getMeshByName('VIP-captain'), null);
// A removed objective and a source placement never keep a synthetic marker.
targets.update(snapshot([source]));
assert.equal(captureMesh.isDisposed(), true);
baseline();

targets.update(snapshot([destroy], [vip]));
const removedDestroy = mesh('objective-destroy');
const removedVip = mesh('VIP-captain');
targets.update(snapshot([]));
assert.equal(removedDestroy.isDisposed(), true);
assert.equal(removedVip.isDisposed(), true);
baseline();
// sourcePlacementId can replace a previously synthetic objective with the same id.
targets.update(snapshot([destroy]));
const replaced = mesh('objective-destroy');
targets.update(snapshot([{...destroy, sourcePlacementId: 'original-placement'}]));
assert.equal(replaced.isDisposed(), true);
baseline();

targets.update(snapshot([capture, destroy], [vip]));
const cleared = scene.meshes.filter(value => !baselineMeshes.includes(value));
targets.clear();
cleared.forEach(value => assert.equal(value.isDisposed(), true));
baseline();
targets.clear();
baseline();
targets.update(snapshot([capture], [{...vip, isVIP: false}]));
assert.equal(scene.getMeshByName('VIP-captain'), null);
const noMatch = snapshot([]);
delete noMatch.match;
targets.update(noMatch);
baseline();
scene.dispose();
engine.dispose();
console.log('PASS: actual objective/VIP geometry, team/contested colors, movement, source placement reuse, death/missing disposal, repeat snapshot reuse and scene baseline restoration');
