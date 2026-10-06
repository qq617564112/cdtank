import assert from 'node:assert/strict';
import {ArcRotateCamera, NullEngine, Scene, Vector3} from '@babylonjs/core';
import {BattlePlayers} from '../apps/web/src/render/battle-players';
import type {PlayerSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';

const engine = new NullEngine();
const scene = new Scene(engine);
const camera = new ArcRotateCamera('observer', 0, 1, 10, Vector3.Zero(), scene);
const effects = {attach() {}, detach() {}, remove() {}, revive() {}, petDeath() {}, queuedParts() {return false;}};
const players = new BattlePlayers(scene, camera, effects);
const calls: Array<{id: string; increase: number; local: boolean}> = [];
const subject = players as unknown as {
  players: Map<string, unknown>;
  benefit(id: string, increase: number, local: boolean): void;
  loadPlayer(player: PlayerSnapshot): Promise<void>;
};
subject.benefit = (id, increase, local) => {calls.push({id, increase, local});};
subject.loadPlayer = async () => {};
function snapshot(hp: number, tankId = 1): PlayerSnapshot {
  return {id: 'P1', tankId, hp, alive: hp > 0, x: 0, y: 0, z: 0} as PlayerSnapshot;
}
function attach(): void {
  subject.players.set('P1', {tankId: 1, position() {}, dispose() {}});
}
function update(hp: number, tankId = 1): void {
  players.reconcile([snapshot(hp, tankId)], 'P1');
}
try {
  attach();
  update(100);
  update(50);
  update(50);
  assert.deepEqual(calls, []);
  update(80);
  update(80);
  assert.deepEqual(calls, [{id: 'P1', increase: 30, local: true}]);
  update(0);
  update(100);
  assert.equal(calls.length, 1);
  update(120);
  assert.deepEqual(calls[1], {id: 'P1', increase: 20, local: true});
  players.resetRound([snapshot(200)]);
  update(200);
  assert.equal(calls.length, 2);
  players.reconcile([]);
  attach();
  update(300);
  assert.equal(calls.length, 2);
  update(400, 2);
  assert.equal(calls.length, 2);
  players.clear();
  attach();
  update(500);
  assert.equal(calls.length, 2);
  console.log('PASS HP snapshot observer: increase once; first/decrease/death/revival/round/remove/selection/Leave silent');
} finally {
  scene.dispose();
  engine.dispose();
}
