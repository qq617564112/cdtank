import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {MsgRoomEvent, PlayerSnapshot} from '../apps/shared/protocols';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';

let now = 100000;
const world = new World(() => now, {timeLimitSeconds: 30});
const joined = world.createAndJoin('cure-cpu', 4, 7, 'CureCPU', 'Observer', 1);
const cpuIds = Array.from({length: 3}, () => world.manageCpu(joined.playerId, 1, 'ADD', 1));
const record = (instanceId: number, itemTableId: number, quantity: number): InventoryWireRecord => ({
  instanceId, itemTableId, ownedQuantity: quantity, battleQuantity: 88, state: 0, field8: 0,
  float24Bits: 0, float28Bits: 0, float2cBits: 0});
for (const [index, id] of cpuIds.entries()) {
  world.bindInventory(id, {records: [record(100 + index, 2007, 15), record(200 + index, 3, 2)],
    hotkeys: [100 + index, 0, 0, 200 + index, 0, 0, 0]});
}
world.ready(joined.playerId, 1);
const cures: {round: number; tick: number; before: PlayerSnapshot; burn: object; input: object; event: MsgRoomEvent}[] = [];
const naturalHits: MsgRoomEvent[] = [];
const results = [];
const stocks = [];
for (let round = 1; round <= 2; round++) {
  if (round === 2) {
    const before = cpuIds.map(id => world.inventory(id).records.map(item => item.ownedQuantity));
    world.rematch(joined.playerId, 1);
    assert.equal(world.snapshot(joined.roomId)!.match!.round, 2);
    for (const [index, id] of cpuIds.entries()) {
      assert.deepEqual(world.inventory(id).records.map(item => item.ownedQuantity), before[index]);
      assert.deepEqual(world.inventory(id).records.map(item => item.battleQuantity), before[index], 'Rematch uses remaining stock, not fresh fixture');
    }
  }
  for (let tick = 0; tick < 700 && world.snapshot(joined.roomId)!.phase === 'PLAYING'; tick++) {
    const snapshot = world.snapshot(joined.roomId)!;
    const authority = world['rooms'].get(joined.roomId)!.players;
    const burns = new Map([...authority].map(([id, player]) => [id, player.burn ? {...player.burn} : undefined]));
    now += 50;
    const events = world.step(50).events;
    naturalHits.push(...events.filter(event => event.type === 'hit'));
    for (const event of events.filter(event => event.type === 'itemUsed' && event.skillId === 3)) {
      assert(cpuIds.includes(event.playerId));
      const before = snapshot.players.find(player => player.id === event.playerId)!;
      const burn = burns.get(event.playerId);
      assert(before.alive && burn, 'Cure requires an observed live natural burn');
      assert(naturalHits.some(hit => hit.targetId === event.playerId), 'Natural projectile hit precedes cure');
      assert.equal(event.playSkillEffect!.skillId, 3);
      const actor = authority.get(event.playerId)!;
      assert.equal(actor.burn, undefined);
      assert.equal(actor.input.useItem, 5, 'Controller sends the configured ordinary item slot');
      assert(actor.input.sequence > 0);
      cures.push({round, tick, before, burn, input: {...actor.input}, event});
    }
  }
  assert.equal(world.snapshot(joined.roomId)!.phase, 'FINISHED');
  results.push(structuredClone(world.snapshot(joined.roomId)!.match!.result));
  for (const id of cpuIds) {
    const count = cures.filter(row => row.event.playerId === id).length;
    const injection = world.inventory(id).records.find(item => item.itemTableId === 3)!;
    assert.equal(injection.ownedQuantity, 2 - count);
    assert.equal(injection.battleQuantity, 2 - count);
  }
  stocks.push(cpuIds.map(id => ({id, inventory: world.inventory(id)})));
}
const result = {status: cures.length > 0 ? 'PASS' : 'FAIL', cures, naturalHitCount: naturalHits.length,
  results, stocks, scope: 'Explicit initial CPU2007/item3 kitbag fixtures, ordinary BotController/World inputs and natural projectile burn/cure across two natural30-second rounds. No live position/HP/burn/damage/event/result writes. CPU in-memory inventory only; not persistent account or webpage CPU inventory provisioning.'};
writeFileSync('recovery/output/pet-injection-ai-cpu.json', JSON.stringify(result, null, 2) + '\n');
world.leave(joined.playerId);
assert.equal(world.snapshot(joined.roomId), undefined);
assert(cures.length > 0, 'Natural CPU2007 combat must produce ordinary item3 cure');
console.log(`PASS: ${cures.length} natural CPU burn cures, finite quantities, two settlements and no rematch replenishment`);
