import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World, type WorldEvent} from '../apps/server/src/world';
import type {PlayerState} from '../apps/server/src/battle/player-state';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-invincibility-ai-'));
const database = join(directory, 'accounts.sqlite');
let store = new AccountStore(database), now = 100000;
// Private access observes accepted inputs, actual collision HP and cleanup only.
function actualPlayers(world: World, roomId: string): Map<string, PlayerState> {
  return (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(roomId)!.players;
}
try {
  const account = store.open();
  store.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 8, ownedQuantity: 3,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  store.assign(account.accountId, 77, 4);
  let persistedConsumes = 0;
  const world: World = new World(() => now, {consumeItem: (id, instance, quantity, definition) => {
    assert.equal(id, owner.playerId); assert.equal(instance, 77); assert.equal(definition, 8);
    assert.equal(quantity, 3 - persistedConsumes);
    const accepted = store.consumeItem(account.accountId, instance, quantity, definition);
    assert(accepted); persistedConsumes++; return accepted;
  }});
  const owner = world.createAndJoin('invincibility-owned-ai', 4, 7, 'Owned invincibility AI', 'Owner', 1);
  world.bindInventory(owner.playerId, store.inventory(account.accountId));
  for (let i = 0; i < 3; i++) world.manageCpu(owner.playerId, 1, 'ADD', 1);
  world.ready(owner.playerId, 1, false);
  world.configureAutopilot(owner.playerId, 1, true);
  assert.equal(world.snapshot(owner.roomId)!.phase, 'WAITING');
  world.ready(owner.playerId, 1);
  const players = actualPlayers(world, owner.roomId), local = players.get(owner.playerId)!;
  const ordinary = {sequence: 1000, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: now};
  assert.deepEqual(world.updateInput(owner.playerId, ordinary), [], 'AI control isolates manual item requests');
  const uses: WorldEvent[] = [], casts: object[] = [], rounds: object[] = [];
  let immuneHits = 0, rewardChecks = 0, naturalHits = 0, deaths = 0, revivals = 0, expiries = 0;
  for (let round = 1; round <= 2; round++) {
    if (round === 2) {
      assert(!world.snapshot(owner.roomId)!.match!.rematchPlayerIds.includes(owner.playerId));
      world.rematch(owner.playerId, 1);
      assert.equal(world.inventory(owner.playerId).records[0].battleQuantity, 3 - uses.length);
    }
    assert.equal(local.invincibility, undefined);
    let roundHits = 0, roundImmuneHits = 0;
    for (let tick = 0; tick < 6200 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
      const before = new Map([...players].map(([id, p]) => [id, {hp: p.hp, score: p.score,
        x: p.x, z: p.z, alive: p.alive, invincibility: p.invincibility}]));
      now += 50; const events = world.step(50).events;
      if (!local.alive) assert.equal(local.invincibility, undefined);
      for (const event of events) {
        assert.notEqual(event.type, 'itemRejected');
        if (event.type === 'hit' && event.targetId === owner.playerId) {naturalHits++; roundHits++;}
        if (event.type === 'destroy' && event.targetId === owner.playerId) {
          deaths++; assert.equal(local.invincibility, undefined);
        }
        if (event.type === 'respawn' && event.playerId === owner.playerId) revivals++;
        if (event.stopSkillEffect?.skillId === 8 && event.playerId === owner.playerId) {
          expiries++; assert.equal(local.invincibility, undefined);
        }
        if (event.type === 'immuneHit' && event.targetId === owner.playerId) {
          immuneHits++; roundImmuneHits++;
          assert.equal(local.hp, before.get(local.id)!.hp, 'Actual protected projectile collision preserves HP');
          assert(!events.some(other => other.type === 'hit' && other.targetId === local.id));
          if (!events.some(other => ['hit', 'destroy'].includes(other.type) && other.playerId === event.playerId)) {
            assert.equal(players.get(event.playerId)!.score, before.get(event.playerId)!.score); rewardChecks++;
          }
        }
        if (event.type !== 'itemUsed') continue;
        assert.equal(event.playerId, owner.playerId); assert.equal(event.skillId, 8);
        const prior = before.get(local.id)!, maxHp = world.roleAttributes(local.id).maxHp;
        assert(naturalHits > 0 && prior.hp > 0 && prior.hp <= maxHp * .5);
        assert([...players.values()].some(enemy => enemy.id !== local.id && before.get(enemy.id)!.alive
          && Math.hypot(before.get(enemy.id)!.x - prior.x, before.get(enemy.id)!.z - prior.z) <= 300));
        assert.equal(local.input.useItem, 5); assert(local.invincibility);
        assert.equal(event.playSkillEffect?.duration, 10);
        uses.push(event); casts.push({round, hp: prior.hp, maxHp, expiresAt: world.snapshot(owner.roomId)!.players.find(player => player.id === local.id)!.invincibility!.expiresAt});
        assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3 - uses.length);
        assert.equal(world.inventory(owner.playerId).records[0].ownedQuantity, 3 - uses.length);
      }
    }
    assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
    assert(world.snapshot(owner.roomId)!.players.every(player => !player.invincibility));
    assert(world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!.isAutopilot);
    rounds.push({round, uses: uses.length, naturalHits: roundHits, immuneHits: roundImmuneHits,
      result: world.snapshot(owner.roomId)!.match!.result});
  }
  assert.equal(uses.length, 3); assert.equal(persistedConsumes, 3);
  assert(immuneHits > 0 && rewardChecks > 0 && deaths > 0 && revivals > 0 && expiries > 0);
  world.configureAutopilot(owner.playerId, 2, false);
  assert(!world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!.isAutopilot);
  world.leave(owner.playerId); assert.equal(world.snapshot(owner.roomId), undefined);
  store.close(); store = new AccountStore(database);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 0);
  assert.equal(store.inventory(account.accountId).records[0].float24Bits, 0x7fc01234);
  assert.equal(store.inventory(account.accountId).hotkeys[3], 77);
  const rejoined = world.createAndJoin('invincibility-owned-ai', 4, 7, 'Rejoin', 'Owner', 1);
  world.bindInventory(rejoined.playerId, store.inventory(account.accountId));
  world.ready(rejoined.playerId, 1); world.configureAutopilot(rejoined.playerId, 1, true);
  for (let i = 0; i < 25; i++) {
    now += 50; assert(!world.step(50).events.some(event => event.type === 'itemUsed' || event.type === 'itemRejected'));
  }
  world.configureAutopilot(rejoined.playerId, 1, false);
  const before = world.snapshot(rejoined.roomId)!.players[0];
  world.updateInput(rejoined.playerId, {...ordinary, sequence: 1, move: 1, useItem: 0});
  now += 50; world.step(50);
  const after = world.snapshot(rejoined.roomId)!.players[0];
  assert(Math.hypot(after.x - before.x, after.z - before.z) > 0);
  assert.equal(actualPlayers(world, rejoined.roomId).get(rejoined.playerId)!.input.sequence, 1);
  world.leave(rejoined.playerId);
  writeFileSync('recovery/output/invincibility-ai-world.json', JSON.stringify({status: 'PASS', uses, casts, rounds,
    immuneHits, rewardChecks, naturalHits, deaths, revivals, expiries, persistedConsumes,
    persisted: store.inventory(account.accountId), manualDisplacement: Math.hypot(after.x - before.x, after.z - before.z),
    scope: 'Explicit account initial item ownership, ordinary Autopilot/Ready and automatic accepted shortcuts after natural half-health injury and nearby enemy, actual projectile immunity/no hit reward, stock CAS, natural death/revive/expiry/finish/rematch, store reopen, exhausted reentry and manual sequence recovery. Read-only battle observation; rebuilt AI and authority policy.'}, null, 2));
  console.log('PASS: persistent invincibility AI, three natural injured casts/protected hits, two rounds and manual recovery');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
