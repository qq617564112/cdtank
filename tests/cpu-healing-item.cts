import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World, type WorldEvent} from '../apps/server/src/world';
import type {PlayerSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';

let now = 100000;
const world = new World(() => now);
const owner = world.createAndJoin('cpu-healing-observer', 4, 7, 'CPU治疗', 'Observer', 1);
const cpuIds = Array.from({length: 3}, () => world.manageCpu(owner.playerId, 1, 'ADD', 1));
for (const [index, cpuId] of cpuIds.entries()) {
  const record: InventoryWireRecord = {instanceId: 100 + index, itemTableId: index % 2 === 0 ? 1 : 2,
    ownedQuantity: 3, battleQuantity: 88, state: 0, field8: 0,
    float24Bits: 0, float28Bits: 0, float2cBits: 0};
  world.bindInventory(cpuId, {records: [record], hotkeys: [0, 0, 0, record.instanceId, 0, 0, 0]});
}
world.ready(owner.playerId, 1);
const used: {tick: number; before: PlayerSnapshot; event: WorldEvent}[] = [];
const hit: WorldEvent[] = [];
for (let tick = 0; tick < 6200 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
  const before = world.snapshot(owner.roomId)!;
  now += 50;
  const step = world.step(50);
  for (const event of step.events) {
    if (event.type === 'hit') hit.push(event);
    if (event.type !== 'itemUsed') continue;
    assert(cpuIds.includes(event.playerId));
    const player = before.players.find(p => p.id === event.playerId)!;
    assert(player.alive && player.hp < player.maxHp, 'CPU chooses healing from observed injury before the step');
    const skillId = cpuIds.indexOf(event.playerId) % 2 === 0 ? 1 : 2;
    assert(event.value > 0 && event.value <= (skillId === 1 ? 200 : 400));
    assert(hit.some(previous => previous.targetId === event.playerId), 'CPU injury originates in normal combat');
    assert.equal(event.skillId, skillId);
    assert.equal(event.playSkillEffect?.skillId, skillId);
    used.push({tick, before: player, event});
  }
}
assert(used.length > 0, 'Unmodified CPU must autonomously emit normal healing inputs');
for (const id of cpuIds) {
  const consumed = used.filter(row => row.event.playerId === id).length;
  const item = world.inventory(id).records[0];
  assert.equal(item.ownedQuantity, 3 - consumed);
  assert.equal(item.battleQuantity, 3 - consumed);
}
assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
const firstResult = structuredClone(world.snapshot(owner.roomId)!.match!.result);
assert(cpuIds.every(id => world.inventory(id).records[0].ownedQuantity === 0),
  'Natural CPU strategy must exhaust the explicitly supplied three portions');
world.rematch(owner.playerId, 1);
assert.equal(world.snapshot(owner.roomId)!.match!.round, 2);
assert(cpuIds.every(id => world.inventory(id).records[0].battleQuantity === 0),
  'The next round must not replenish exhausted inventory');
let secondRoundHits = 0;
for (let tick = 0; tick < 6200 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
  now += 50;
  const step = world.step(50);
  assert(!step.events.some(event => event.type === 'itemUsed'), 'Exhausted CPUs cannot heal in round2');
  secondRoundHits += step.events.filter(event => event.type === 'hit').length;
}
assert(secondRoundHits > 0);
assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
assert(cpuIds.every(id => world.inventory(id).records[0].ownedQuantity === 0
  && world.inventory(id).records[0].battleQuantity === 0));
writeFileSync('recovery/output/cpu-healing-item.json', JSON.stringify({status: 'PASS',
  scope: 'Explicit CPU fixture inventory, unmodified autonomous BotController emits ordinary Digit5 inputs only. Natural combat injury/healing/quantity/effect events and two terminal rounds with stock exhaustion preserved on rematch; no pose/HP/damage/result injections. Rebuilt server healing/consumption semantics.', used,
  firstResult, secondRoundHits, result: world.snapshot(owner.roomId)!.match!.result}, null, 2));
console.log(`PASS: ${used.length} autonomous CPU healing uses after normal combat injury, count/effect events, exhausted inventory preserved and two natural settlements`);
