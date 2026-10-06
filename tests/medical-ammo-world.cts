import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {TSBuffer} from 'tsbuffer';
import {World} from '../apps/server/src/world';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgPlayerInput, MsgRoomEvent} from '../apps/shared/protocols';

let now = 100000;
const consumed: number[] = [];
const world = new World(() => now, {timeLimitSeconds: 60,
  consumeItem: (_id, instance, expected, table) => {
    assert.equal(instance, 77); assert.equal(table, 2009);
    consumed.push(expected); return true;
  }});
const host = world.createAndJoin('medical-host', 4, 7, 'Medical', 'Host', 1);
const guest = world.joinRoom(host.roomId, 'medical-guest', 'Guest', 1);
world.bindInventory(host.playerId, {hotkeys: [77, 0, 0, 0, 0, 0, 0],
  records: [{instanceId: 77, itemTableId: 2009, ownedQuantity: 2, battleQuantity: 0,
    state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]});
world.ready(guest.playerId, 1); world.ready(host.playerId, 1);
const events: MsgRoomEvent[] = [];
const idle: MsgPlayerInput = {sequence: 0, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: now};
let sequence = 0;
const input = (patch: Partial<MsgPlayerInput>) => world.updateInput(host.playerId,
  {...idle, ...patch, sequence: ++sequence, clientTime: now});
const step = () => {now += 50; events.push(...world.step(50).events);};
const player = (id: string) => world.snapshot(host.roomId)!.players.find(p => p.id === id)!;
let aimed = false;
for (let tick = 0; tick < 400; tick++) {
  const owner = player(host.playerId), target = player(guest.playerId);
  const desired = Math.atan2(target.x - owner.x, target.z - owner.z);
  const difference = Math.atan2(Math.sin(desired - owner.yaw - owner.aim),
    Math.cos(desired - owner.yaw - owner.aim));
  if (Math.abs(difference) < .025) {aimed = true; break;}
  input({aim: Math.sign(difference)}); step();
}
assert(aimed, 'Ordinary turret input reaches the other original spawn');
input({fire: true}); step(); input({});
const damage = events.find(e => e.type === 'hit' && e.targetId === guest.playerId);
assert(damage && damage.value > 0);
const wounded = player(guest.playerId);
assert(wounded.hp < wounded.maxHp);
const score = player(host.playerId).score;
input({useItem: 2});
assert.equal(player(host.playerId).ammoItemId, 2009);
input({fire: true});
for (let tick = 0; tick < 240 && !events.some(e => e.type === 'playerHealed'); tick++) step();
input({});
const healing = events.find(e => e.type === 'playerHealed')!;
assert(healing);
assert.equal(healing.value, Math.min(300, wounded.maxHp - wounded.hp));
assert.equal(player(guest.playerId).hp, wounded.hp + healing.value);
assert.equal(player(host.playerId).score, score);
assert.equal(events.filter(e => e.type === 'hit').length, 1);
assert.equal(events.filter(e => e.type === 'destroy').length, 0);
assert.deepEqual(consumed, [2]);
assert.equal(world.inventory(host.playerId).records[0].ownedQuantity, 1);
const codec = new TSBuffer(serviceProto.types);
const encoded = codec.encode(healing, 'MsgRoomEvent/MsgRoomEvent'); assert(encoded.isSucc);
const decoded = codec.decode<MsgRoomEvent>(encoded.buf, 'MsgRoomEvent/MsgRoomEvent');
assert(decoded.isSucc); assert.deepEqual(decoded.value, healing);
world.leave(guest.playerId); world.leave(host.playerId);
writeFileSync('recovery/output/medical-ammo-world.json', JSON.stringify({status: 'PASS_WORLD_SCOPE',
  scope: 'Ordinary World turret/default shot causes a real wound, selected medical projectile heals without damage/score, finite consumption and existing wire codec. Pre-room inventory and persistence callback are module fixtures.',
  damage, healing, woundedHp: wounded.hp, maxHp: wounded.maxHp, consumed, noHealingHitScore: true,
  normalLeave: true}, null, 2) + '\n');
console.log('PASS: normal World wound then medical projectile healing, no hit reward, finite stock and event wire');
