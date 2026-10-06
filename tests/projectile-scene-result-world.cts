import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {TSBuffer} from 'tsbuffer';
import {World} from '../apps/server/src/world';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomEvent} from '../apps/shared/protocols';

let now = 100000;
const world = new World(() => now, {minPlayers: 4, timeLimitSeconds: 60,
  consumeItem: () => true});
const host = world.createAndJoin('scene-result-host', 1, 7, 'Scene', 'Shooter', 1);
const peers = Array.from({length: 3}, (_, index) =>
  world.joinRoom(host.roomId, `scene-result-${index}`, 'Observer', 1));
world.bindInventory(host.playerId, {hotkeys: [77, 0, 0, 0, 0, 0, 0], records: [{
  instanceId: 77, itemTableId: 2002, ownedQuantity: 15, battleQuantity: 0, state: 0,
  field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]});
for (const peer of peers) world.ready(peer.playerId, 1);
world.ready(host.playerId, 1);
const snapshot = () => world.snapshot(host.roomId)!;
const player = () => snapshot().players.find(value => value.id === host.playerId)!;
const target = () => snapshot().match!.sceneObjects!.find(value => value.id === 'ENV:79')!;
assert(target());
const events: MsgRoomEvent[] = [];
let sequence = 0;
const input = (aim = 0, fire = false, useItem = 0) => {
  world.updateInput(host.playerId, {sequence: ++sequence, move: 0, turn: 0, aim, fire,
    useItem, clientTime: now});
  now += 50; events.push(...world.step(50).events);
};
input(0, false, 2);
assert.equal(player().ammoItemId, 2002);
let aimed = false;
for (let tick = 0; tick < 400; tick++) {
  const p = player(), t = target();
  const bearing = Math.atan2(t.x - p.x, t.z - p.z);
  const error = Math.atan2(Math.sin(bearing - p.yaw - p.aim), Math.cos(bearing - p.yaw - p.aim));
  if (Math.abs(error) < .0001) {aimed = true; break;}
  input(Math.max(-1, Math.min(1, error / .045)));
}
assert(aimed);
for (let tick = 0; tick < 500 && target().hp > 0; tick++) input(0, true);
input();
assert.equal(target().hp, 0);
const results = events.filter(event => event.shotItemResult);
assert.equal(results.length, 1);
const result = results[0];
assert.equal(result.type, 'sceneObjectDestroyed'); assert.equal(result.targetId, 'ENV:79');
assert.deepEqual(result.shotItemResult, {itemId: 2002, x: result.x, y: result.y, z: result.z});
assert(events.some(event => event.type === 'sceneObjectHit' && !event.shotItemResult));
assert(events.filter(event => event.type === 'fire' || event.type === 'terrainHit').every(event => !event.shotItemResult));
const codec = new TSBuffer(serviceProto.types);
const wire = codec.encode(result, 'MsgRoomEvent/MsgRoomEvent'); assert(wire.isSucc);
const decoded = codec.decode<MsgRoomEvent>(wire.buf, 'MsgRoomEvent/MsgRoomEvent'); assert(decoded.isSucc);
assert.deepEqual(decoded.value, result);
const inventory = world.inventory(host.playerId);
for (const peer of peers) world.leave(peer.playerId);
world.leave(host.playerId); assert.equal(world.snapshot(host.roomId), undefined);
writeFileSync('recovery/output/projectile-scene-result-world.json', JSON.stringify({status: 'PASS_ORDINARY_WORLD_INPUT_SCOPE',
  fixture: 'Pre-room inventory15/CAS callback fixture and simulated clock; four ordinary World participants, original map7/spawns, no active state injection.',
  result, inventory, hits: events.filter(event => event.type === 'sceneObjectHit'), normalLeave: true,
  wireRoundtrip: true, scope: 'Formal World ordinary aiming/selected2002/fire destroys ENV79, first lethal result only. Browser purchase/dual render acceptance separate.'}, null, 2) + '\n');
console.log('PASS: ordinary World2002 input lethal ENV79 result and wire, normal Leave');
