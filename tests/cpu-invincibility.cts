import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World, type WorldEvent} from '../apps/server/src/world';
import {healingHotkey, invincibilityHotkey, attackDrinkHotkey, speedDrinkHotkey} from '../apps/server/src/battle/cpu/items';
import {BotController} from '../apps/server/src/battle/cpu/controller';
import {getBattlefield} from '../apps/server/src/battlefield';
import type {PlayerState} from '../apps/server/src/battle/player-state';

const actor = {alive: true, hp: 80, maxHp: 300, movementReady: true,
  inventory: [{instanceId: 77, itemTableId: 8, ownedQuantity: 2, battleQuantity: 2},
    {instanceId: 88, itemTableId: 1, ownedQuantity: 1, battleQuantity: 1},
    {instanceId: 99, itemTableId: 4, ownedQuantity: 1, battleQuantity: 1},
    {instanceId: 111, itemTableId: 6, ownedQuantity: 1, battleQuantity: 1}],
  combat: {record: {arrays: new Map([[0, Int32Array.from([0, 0, 0, 77, 88, 99, 111])], [4, new Int32Array(16)]])}}};
assert.equal(invincibilityHotkey(actor, true), 5);
assert.equal(invincibilityHotkey({...actor, hp: 150}, true), 5);
for (const value of [{...actor, alive: false}, {...actor, hp: 0}, {...actor, maxHp: 0},
  {...actor, hp: 151}, {...actor, hp: 300}, {...actor, hp: undefined}, {...actor, maxHp: undefined}]) {
  assert.equal(invincibilityHotkey(value, true), 0);
}
assert.equal(invincibilityHotkey(actor, false), 0);
assert.equal(healingHotkey(actor) || invincibilityHotkey(actor, true) || attackDrinkHotkey(actor, true)
  || speedDrinkHotkey(actor, true), 6);
assert.equal(healingHotkey({...actor, hp: 150}) || invincibilityHotkey({...actor, hp: 150}, true)
  || attackDrinkHotkey(actor, true) || speedDrinkHotkey(actor, true), 5);
actor.combat.record.arrays.get(4)![0] = 8;
assert.equal(invincibilityHotkey(actor, true), 0);
actor.combat.record.arrays.get(4)!.fill(999);
assert.equal(invincibilityHotkey(actor, true), 0);
actor.combat.record.arrays.set(4, new Int32Array(15));
assert.equal(invincibilityHotkey(actor, true), 0);
actor.combat.record.arrays.set(4, new Int32Array(16));
actor.inventory[0].battleQuantity = 0;
assert.equal(invincibilityHotkey(actor, true), 0);
actor.inventory[0].battleQuantity = 2; actor.inventory[0].ownedQuantity = 0;
assert.equal(invincibilityHotkey(actor, true), 0);
actor.inventory[0].ownedQuantity = 2;
const bot = {...actor, id: 'test', x: 0, y: 0, z: 0, yaw: 0, aim: 0, team: 0, vip: false,
  tank: {speed: 30, turn: 100}, hp: 150};
const opponent = {...bot, id: 'enemy', team: 1, z: 300};
const choose = (enemies: typeof bot[], hp = 150) => {
  const controller = new BotController();
  controller.input({...bot, hp}, enemies, [], getBattlefield(7), 1, 100000, .05);
  return controller.input({...bot, hp}, enemies, [], getBattlefield(7), 1, 100050, .05).useItem;
};
assert.equal(choose([opponent]), 5, 'Real nearby enemy chooses immunity before attack drink');
assert.equal(choose([opponent], 80), 6, 'Healing retains priority');
assert.notEqual(choose([{...opponent, z: 301}]), 5);
assert.notEqual(choose([{...opponent, alive: false}]), 5);
assert.notEqual(choose([{...opponent, team: 0}]), 5);

let now = 100000;
const castObservations = new Map<string, ReturnType<World['snapshot']>>();
const world: World = new World(() => now, {consumeItem: id => {
  // The earlier actors may already have moved within this tick. Observe the exact
  // normal consumption boundary, without changing live battle state.
  castObservations.set(id, world.snapshot(owner.roomId));
  return true;
}});
const owner = world.createAndJoin('invincibility-observer', 4, 7, 'CPU invincibility', 'Observer', 1);
const ids = Array.from({length: 3}, () => world.manageCpu(owner.playerId, 1, 'ADD', 1));
for (const [index, id] of ids.entries()) {
  world.bindInventory(id, {hotkeys: [0, 0, 0, 77 + index, 0, 0, 0], records: [{instanceId: 77 + index,
    itemTableId: 8, ownedQuantity: 2, battleQuantity: 0, state: 0, field8: 0,
    float24Bits: 0, float28Bits: 0, float2cBits: 0}]});
}
world.ready(owner.playerId, 1);
// Private state access observes accepted inputs and HP; the battle runs normally.
const players = (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(owner.roomId)!.players;
const used: WorldEvent[] = [], casts: object[] = [], counts: number[][] = [];
const injured = new Set<string>();
let immuneHits = 0, rewardChecks = 0, expiries = 0, deaths = 0;
for (let round = 1; round <= 2; round++) {
  if (round === 2) world.rematch(owner.playerId, 1);
  assert(world.snapshot(owner.roomId)!.players.every(player => !player.invincibility));
  for (let tick = 0; tick < 6200 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
    const before = new Map([...players].map(([id, p]) => [id, {hp: p.hp, score: p.score,
      x: p.x, z: p.z, alive: p.alive, invincibility: p.invincibility}]));
    now += 50; const events = world.step(50).events;
    for (const p of players.values()) if (!p.alive) assert.equal(p.invincibility, undefined);
    for (const event of events) {
      assert.notEqual(event.type, 'itemRejected');
      if (event.type === 'hit' && ids.includes(event.targetId!)) injured.add(event.targetId!);
      if (event.type === 'destroy' && ids.includes(event.targetId!)) deaths++;
      if (event.stopSkillEffect?.skillId === 8) expiries++;
      if (event.type === 'immuneHit' && ids.includes(event.targetId!)) {
        immuneHits++;
        assert.equal(players.get(event.targetId!)!.hp, before.get(event.targetId!)!.hp);
        assert(!events.some(other => other.type === 'hit' && other.targetId === event.targetId));
        if (!events.some(other => ['hit', 'destroy'].includes(other.type) && other.playerId === event.playerId)) {
          assert.equal(players.get(event.playerId)!.score, before.get(event.playerId)!.score); rewardChecks++;
        }
      }
      if (event.type !== 'itemUsed') continue;
      assert(ids.includes(event.playerId)); assert.equal(event.skillId, 8);
      const p = players.get(event.playerId)!, prior = before.get(p.id)!;
      assert(injured.has(p.id), 'CPU immunity follows actual natural injury');
      assert(prior.hp > 0 && prior.hp <= world.roleAttributes(p.id).maxHp * .5);
      const decision = castObservations.get(p.id)!;
      const decisionOwner = decision.players.find(player => player.id === p.id)!;
      assert(decision.players.some(enemy => enemy.id !== p.id && enemy.alive
        && Math.hypot(enemy.x - decisionOwner.x, enemy.z - decisionOwner.z) <= 300));
      assert.equal(p.input.useItem, 5); assert(p.invincibility);
      assert.equal(event.playSkillEffect?.duration, 10);
      used.push(event); casts.push({round, playerId: p.id, hp: prior.hp, maxHp: world.roleAttributes(p.id).maxHp});
    }
  }
  assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
  assert(world.snapshot(owner.roomId)!.players.every(player => !player.invincibility));
  counts.push(ids.map(id => world.inventory(id).records[0].ownedQuantity));
}
assert.equal(used.length, 6); assert(immuneHits > 0 && rewardChecks > 0 && expiries > 0 && deaths > 0);
assert.deepEqual(counts, [[0, 0, 0], [0, 0, 0]]);
world.leave(owner.playerId);
writeFileSync('recovery/output/cpu-invincibility.json', JSON.stringify({status: 'PASS', used, casts, counts,
  immuneHits, rewardChecks, expiries, deaths,
  scope: 'Rebuilt AI policy with explicit initial CPU ownership; ordinary accepted shortcuts after natural half-health injury and nearby enemies, actual projectile immunity and no hit reward, expiry/death/finish/rematch cleanup and finite stock over two natural rounds. Read-only battle observation.'}, null, 2));
console.log('PASS: CPU invincibility strategy, six natural injured casts, protected hits/no rewards and two finite-stock rounds');
