import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {configureRoomCpuLoadout} from '../apps/server/src/rooms/cpu-loadout';
import {confirmBattleItemConsumption} from '../apps/server/src/battle/items/consumption';
import type {CpuLoadoutItem} from '../apps/shared/protocols/PtlCpu';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';

let now = 100000;
let persisted = 0;
const world = new World(() => now, {consumeItem: () => {persisted++; return false;}});
const joined = world.createAndJoin('loadout-owner', 4, 7, 'CPUStock', 'Owner', 1);
const cpuId = world.manageCpu(joined.playerId, 1, 'ADD', 1);
const peer = world.joinRoom(joined.roomId, 'loadout-peer', 'Peer', 1);
const room = world['rooms'].get(joined.roomId)!;
const owner = room.players.get(joined.playerId)!;
const cpu = room.players.get(cpuId)!;
const loadout: CpuLoadoutItem[] = [{slot: 2, itemTableId: 2007, quantity: 1},
  {slot: 5, itemTableId: 3, quantity: 2}];
configureRoomCpuLoadout(room, owner, cpuId, loadout);
assert.deepEqual(cpu.inventory.map(item => [item.itemTableId, item.ownedQuantity, item.battleQuantity]), [[2007, 1, 1], [3, 2, 2]]);
assert.equal(cpu.combat.record!.arrays.get(0)![0], 2);
assert.equal(cpu.combat.record!.arrays.get(0)![3], 5);
assert.deepEqual([...room.ready], [cpuId]);
const hp = cpu.hp, status = cpu.combat.status;
const invalid: (CpuLoadoutItem[] | undefined)[] = [undefined,
  [{slot: 2, itemTableId: 2007, quantity: 1}, {slot: 2, itemTableId: 2011, quantity: 1}],
  [{slot: 1, itemTableId: 2007, quantity: 1}], [{slot: 9, itemTableId: 3, quantity: 1}],
  [{slot: 2, itemTableId: 3, quantity: 1}], [{slot: 5, itemTableId: 2007, quantity: 1}],
  [{slot: 5, itemTableId: 9, quantity: 1}], [{slot: 5, itemTableId: 3, quantity: 0}],
  [{slot: 5, itemTableId: 3, quantity: 6}], [{slot: 5, itemTableId: 3, quantity: 1.5}]];
for (const value of invalid) {
  room.ready.add(owner.id);
  const before = JSON.stringify(cpu.inventory), hotkeys = [...cpu.combat.record!.arrays.get(0)!], ready = [...room.ready];
  assert.throws(() => configureRoomCpuLoadout(room, owner, cpuId, value));
  assert.equal(JSON.stringify(cpu.inventory), before);
  assert.deepEqual([...cpu.combat.record!.arrays.get(0)!], hotkeys);
  assert.deepEqual([...room.ready], ready);
}
for (const [manager, target] of [[room.players.get(peer.playerId)!, cpuId], [cpu, cpuId], [owner, peer.playerId], [owner, 'missing']] as const) {
  assert.throws(() => configureRoomCpuLoadout(room, manager, target, loadout));
}
assert.equal(cpu.hp, hp);
assert.equal(cpu.combat.status, status);
assert.deepEqual(owner.inventory, []);
const stock = structuredClone(cpu.inventory);
assert(confirmBattleItemConsumption(cpu, 2, 1, 2007, () => assert.fail('CPU must not enter account persistence')));
assert(!confirmBattleItemConsumption(cpu, 2, 2, 2007));
assert(!confirmBattleItemConsumption(cpu, 2, 1, 2011));
assert(!confirmBattleItemConsumption(cpu, 99, 1, 2007));
assert(!confirmBattleItemConsumption(undefined, 2, 1, 2007));
assert(!confirmBattleItemConsumption({...cpu, inventory: [{...cpu.inventory[0], battleQuantity: 0}]}, 2, 1, 2007));
assert(!confirmBattleItemConsumption({...cpu, inventory: [{...cpu.inventory[0], ownedQuantity: 0}]}, 2, 0, 2007));
assert.deepEqual(cpu.inventory, stock, 'Confirmation does not decrement');
assert(!confirmBattleItemConsumption(owner, 2, 1, 2007, id => {assert.equal(id, owner.id); return false;}));
assert(confirmBattleItemConsumption(owner, 2, 1, 2007));
configureRoomCpuLoadout(room, owner, cpuId, []);
assert.deepEqual(cpu.inventory, []);
assert.deepEqual([...cpu.combat.record!.arrays.get(0)!], Array(7).fill(0));

// Public World CONFIGURE must feed ordinary autonomous fire with global account CAS present.
world.manageCpu(owner.id, 1, 'CONFIGURE', 1, cpuId, loadout);
world.ready(peer.playerId, 1);
world.ready(owner.id, 1);
assert.throws(() => world.manageCpu(owner.id, 1, 'CONFIGURE', 1, cpuId, []));
const events: MsgRoomEvent[] = [];
for (let tick = 0; tick < 400 && !events.some(event => event.type === 'ammoConsumed'); tick++) {
  now += 50;
  events.push(...world.step(50).events);
}
const consumed = events.find(event => event.type === 'ammoConsumed' && event.playerId === cpuId);
assert(consumed, 'Configured CPU must autonomously consume its finite2007');
assert(events.some(event => event.type === 'fire' && event.playerId === cpuId && event.skillId === 2007));
assert.equal(world.inventory(cpuId).records.find(item => item.itemTableId === 2007)!.ownedQuantity, 0);
assert.equal(persisted, 0, 'CPU temporary stock must bypass global account callback');
world.leave(peer.playerId);
world.leave(owner.id);
assert.equal(world.snapshot(joined.roomId), undefined);
writeFileSync('recovery/output/cpu-loadout.json', JSON.stringify({status: 'PASS',
  scope: 'Temporary CPU-only CONFIGURE atomic validation/ready state, no account/HP writes; helper confirmation and ordinary World autonomous finite fire with global persist false.',
  loadout, invalidCount: invalid.length, consumed, persisted}, null, 2) + '\n');
console.log('PASS: CPU temporary stock atomic configuration, consumption isolation and ordinary finite fire');
