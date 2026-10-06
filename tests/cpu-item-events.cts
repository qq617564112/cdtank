import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {BotController} from '../apps/server/src/battle/cpu/controller';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';

let now = 100000;
const world = new World(() => now);
const owner = world.createAndJoin('cpu-item-owner', 4, 7, 'CPU item events', 'Observer', 1);
const cpuIds = Array.from({length: 3}, () => world.manageCpu(owner.playerId, 1, 'ADD', 1));
const record = (instanceId: number, itemTableId: number): InventoryWireRecord => ({
  instanceId, itemTableId, ownedQuantity: 20, battleQuantity: 20, state: 0,
  field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0,
});
for (const [index, cpuId] of cpuIds.entries()) {
  world.bindInventory(cpuId, {records: [record(100 + index, 1), record(200 + index, 3001)],
    hotkeys: [0, 200 + index, 0, 100 + index, 0, 0, 0]});
}
world.ready(owner.playerId, 1);
// Deterministic input driver replaces only CPU key choices. It keeps the normal
// steering/fire output and sequence; no pose, damage, quantity or result writes.
const room = (world as unknown as {rooms: Map<string, {players: Map<string, {cpu?: BotController}>}>})
  .rooms.get(owner.roomId)!;
for (const cpuId of cpuIds) {
  const cpu = room.players.get(cpuId)!.cpu!;
  const input = cpu.input.bind(cpu);
  let tick = 0;
  cpu.input = (...args) => ({...input(...args), useItem: [5, 3, 3][tick++] ?? 0});
}
const before = cpuIds.map(id => world.inventory(id));
const observed = [];
for (const [tick, expectedKind] of ['useItem', 'placeTrap', undefined].entries()) {
  now += 50;
  const result = world.step(50);
  const requests = result.events.filter(event => event.type === 'itemRequest');
  assert.equal(requests.length, expectedKind ? 3 : 0,
    'Accepted CPU inputs must reach the returned event stream; repeated trap requests remain rejected');
  for (const [index, cpuId] of cpuIds.entries()) {
    const request = requests.find(event => event.playerId === cpuId);
    if (expectedKind) {
      assert.equal(request!.roomId, owner.roomId);
      assert.deepEqual(request!.itemUseRequest, {kind: expectedKind,
        instanceId: (expectedKind === 'useItem' ? 100 : 200) + index});
    }
    assert.deepEqual(world.inventory(cpuId), before[index], 'Requests are not confirmed casts or consumption');
  }
  observed.push({tick, requests});
}
writeFileSync('recovery/output/cpu-item-events.json', JSON.stringify({status: 'PASS',
  scope: 'Three CPUs with explicitly bound fixture inventory; deterministic ordinary key inputs preserve native bot steering/fire. World step returns permitted item/trap events, rejects repeated trap requests and does not consume. No authority casting or autonomous item selection proved.',
  observed}, null, 2));
console.log('PASS: CPU ordinary item/trap inputs reach World event stream; three identities, trap rejection and quantities preserved');
