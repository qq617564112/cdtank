import assert from 'node:assert/strict';
import {ArcRotateCamera, NullEngine, Scene, Vector3} from '@babylonjs/core';
import {BattlePlayers} from '../apps/web/src/render/battle-players';
import type {PlayerSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new ArcRotateCamera('death', 0, 1, 10, Vector3.Zero(), scene);
const calls: Array<{view: unknown; petType: number; localView: unknown}> = [];
const players = new BattlePlayers(scene, camera, {
  attach() {}, detach() {}, remove() {}, revive() {}, queuedParts() {return false;},
  petDeath(view, petType, localView) {calls.push({view, petType, localView});},
});
const subject = players as unknown as {
  players: Map<string, unknown>; ammoCatalog: CombatCatalog;
  loadPlayer(player: PlayerSnapshot): Promise<void>;
};
subject.ammoCatalog = {items: [], skills: [], dataScales: [], petTypes: [{petId: 1, petType: 2}, {petId: 101, petType: 1}]};
subject.loadPlayer = async () => {};
const view = {tankId: 1, position() {}, dispose() {}};
function update(alive: boolean, petId?: number): void {
  players.reconcile([{id: 'P1', tankId: 1, petId, hp: alive ? 200 : 0,
    alive, x: 0, y: 0, z: 0} as PlayerSnapshot], 'P1');
}
try {
  subject.players.set('P1', view);
  update(false, 1);
  assert.equal(calls.length, 0);
  update(true, 1);
  update(false, 1);
  update(false, 1);
  assert.deepEqual(calls, [{view, petType: 2, localView: view}]);
  update(true, 101);
  update(false, 101);
  assert.equal(calls[1].petType, 1);
  update(true);
  update(false);
  update(true, 999);
  update(false, 999);
  assert.equal(calls.length, 2);
  update(true, 1);
  players.resetRound([]);
  update(false, 1);
  assert.equal(calls.length, 2);
  players.reconcile([]);
  subject.players.set('P1', view);
  update(false, 1);
  assert.equal(calls.length, 2);
  players.clear();
  subject.players.set('P1', view);
  update(false, 1);
  assert.equal(calls.length, 2);
  console.log('PASS snapshot death gate: same actor once, source pet type/local identity, initial/unknown/round/remove/Leave silent');
} finally {
  scene.dispose();
  engine.dispose();
}
