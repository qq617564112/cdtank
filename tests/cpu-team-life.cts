import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World, type WorldEvent} from '../apps/server/src/world';
let now = 100000;
const decisions: {playerId: string; lives: number[]; team: number; alive: boolean}[] = [];
const world: World = new World(() => now, {consumeItem: id => {
  const snapshot = world.snapshot(owner.roomId)!;
  const player = snapshot.players.find(value => value.id === id)!;
  decisions.push({playerId: id, lives: [...snapshot.match!.teamLives], team: player.team, alive: player.alive});
  return true;
}});
const owner = world.createAndJoin('cpu-team-life', 1, 7, 'CPU team life', 'Observer', 1);
const ids = Array.from({length: 3}, () => world.manageCpu(owner.playerId, 1, 'ADD', 1));
for (const [index, id] of ids.entries()) world.bindInventory(id, {hotkeys: [0, 0, 0, 77 + index, 0, 0, 0],
  records: [{instanceId: 77 + index, itemTableId: 501, ownedQuantity: 3, battleQuantity: 0,
    state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]});
world.ready(owner.playerId, 1);
const uses: WorldEvent[] = [], rounds: object[] = [];
let hits = 0, deaths = 0;
for (let round = 1; round <= 2; round++) {
  if (round === 2) world.rematch(owner.playerId, 1);
  const initial = [...world.snapshot(owner.roomId)!.match!.teamLives];
  const stockBefore = ids.map(id => world.inventory(id).records[0].ownedQuantity);
  const expected = [...initial]; let roundUses = 0, roundDeaths = 0;
  for (let tick = 0; tick < 6400 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
    now += 50; const events = world.step(50).events;
    for (const event of events) {
      assert.notEqual(event.type, 'itemRejected');
      if (event.type === 'hit') hits++;
      if (event.type === 'destroy') {
        const target = world.snapshot(owner.roomId)!.players.find(p => p.id === event.targetId)!;
        expected[target.team]--; deaths++; roundDeaths++;
      }
      if (event.type !== 'itemUsed') continue;
      assert(ids.includes(event.playerId)); assert.equal(event.skillId, 501); assert.equal(event.value, 1);
      const decision = decisions[uses.length]; assert(decision.alive);
      assert(decision.lives.every(value => value > 0));
      assert(decision.lives[decision.team] < initial[decision.team]);
      assert.deepEqual(decision.lives, expected, 'Each CPU reads lives after preceding CPU casts');
      expected[decision.team]++; assert(expected[decision.team] <= initial[decision.team]);
      uses.push(event); roundUses++;
    }
    assert.deepEqual(world.snapshot(owner.roomId)!.match!.teamLives, expected,
      'Only accepted item501 and natural destroy events change team life');
  }
  assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
  assert(roundDeaths > 0); rounds.push({round, initial, stockBefore, roundUses, roundDeaths,
    stockAfter: ids.map(id => world.inventory(id).records[0].ownedQuantity), finalLives: expected});
}
assert(uses.length > 0 && hits > 0 && deaths > 0);
assert.deepEqual(ids.map(id => world.inventory(id).records[0].ownedQuantity), [0, 0, 0]);
world.leave(owner.playerId);
writeFileSync('recovery/output/cpu-team-life.json', JSON.stringify({status: 'PASS', uses, decisions, rounds, hits, deaths,
  scope: 'Explicit pre-match finite CPU ownership, ordinary autonomous useItem5 in two natural mode1/map7 rounds; lost life replacement, sequential latest-life reads, exact projectile death accounting and no stock replenishment. Rebuilt AI eligibility; read-only battle observation.'}, null, 2));
console.log('PASS: CPU team-life finite stock, autonomous natural-loss replacement and exact two-round death accounting');
