import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
const row = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows
  .find((row: {tankId: number; part: number}) => row.tankId === 1 && row.part === 0);
const fields = (values: Record<string, number>) => new Map(Object.entries(values).map(([key, value]) => [Number(key), value]));
const results: unknown[] = [];
for (const itemId of [2007, 2011]) {
  let now = 100000;
  const commits: number[] = [];
  const world = new World(() => now, {timeLimitSeconds: 120, consumeItem: (_id, _instance, owned, table) => {
    assert.equal(owned, 1); assert.equal(table, itemId); commits.push(table); return true;
  }});
  const joined = world.createAndJoin('exhaustion', 4, 7, '耗尽验证', 'Owner', 1);
  world.bindRoleSources(joined.playerId, {base: {name: 'Explicit pet source', fields: fields(row.base)},
    equipment: {name: 'Explicit tank source', fields: fields(row.equipment)}});
  world.bindInventory(joined.playerId, {hotkeys: [77, 0, 0, 0, 0, 0, 0], records: [
    {instanceId: 77, itemTableId: itemId, ownedQuantity: 1, battleQuantity: 1,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]});
  world.ready(joined.playerId, 1);
  let sequence = 0;
  const input = (fire: boolean, useItem = 0) => world.updateInput(joined.playerId,
    {sequence: ++sequence, move: 0, turn: 0, aim: 0, fire, useItem, clientTime: now});
  const snapshot = () => world.snapshot(joined.roomId)!.players.find(p => p.id === joined.playerId)!;
  const step = () => {now += 50; return world.step(50).events;};
  const wait = (kind: string) => {
    for (let tick = 0; tick < 500; tick++) {
      const events = step();
      if (events.some(event => event.type === kind && event.playerId === joined.playerId)) return events;
    }
    throw new Error(`Missing natural ${kind}`);
  };
  const capacity = snapshot().ammoMagazine!.capacity;
  input(true); const first = wait('fire'); input(false);
  assert.equal(snapshot().ammoMagazine!.remaining, capacity - 1);
  input(false, 2); assert.equal(snapshot().ammoItemId, itemId);
  input(true); const special = wait('fire');
  assert.equal(special.find(event => event.type === 'fire')!.skillId, itemId);
  assert.equal(world.inventory(joined.playerId).records[0].ownedQuantity, 0);
  const rejected = wait('itemRejected');
  assert.equal(snapshot().ammoItemId, 2001);
  assert.deepEqual(snapshot().ammoMagazine, {remaining: capacity - 1, capacity});
  assert(!rejected.some(event => event.type === 'fire'));
  for (let tick = 0; tick < 120; tick++) assert(!step().some(event => event.type === 'fire'));
  input(true); const resumed = wait('fire');
  assert.equal(resumed.find(event => event.type === 'fire')!.skillId, 2001);
  assert.deepEqual(snapshot().ammoMagazine, {remaining: capacity - 2, capacity});
  assert.deepEqual(commits, [itemId]);
  results.push({itemId, capacity, remainingAfterResume: snapshot().ammoMagazine!.remaining,
    first, special, rejected, resumed, inventory: world.inventory(joined.playerId), commits});
  world.leave(joined.playerId);
}
writeFileSync('recovery/output/ammo-exhaustion-magazine-world.json', JSON.stringify({status: 'PASS',
  scope: 'Normal World inputs, complete pre-match owned fixtures, 2007/2011 finite ammo; automatic default fallback retains ordinary rounds, held fire stops, new input resumes; server producer rebuilt', results}, null, 2));
console.log('PASS: both finite ammo exhaustion workflows retain default magazine and resume through ordinary input');
