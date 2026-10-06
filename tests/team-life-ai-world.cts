import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World, type WorldEvent} from '../apps/server/src/world';
import type {PlayerState} from '../apps/server/src/battle/player-state';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-team-life-ai-'));
const database = join(directory, 'accounts.sqlite');
let store = new AccountStore(database), now = 100000;
try {
  const account = store.open();
  store.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 501, ownedQuantity: 3,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  store.assign(account.accountId, 77, 4);
  const commits: object[] = [];
  let persistedConsumes = 0;
  const world: World = new World(() => now, {consumeItem: (id, instance, quantity, definition) => {
    assert.equal(id, owner.playerId); assert.equal(instance, 77); assert.equal(definition, 501);
    assert.equal(quantity, 3 - persistedConsumes);
    const lives = [...world.snapshot(owner.roomId)!.match!.teamLives];
    assert(lives.every(value => value > 0)); assert(lives[local.team] < initialLives[local.team]);
    const accepted = store.consumeItem(account.accountId, instance, quantity, definition);
    assert(accepted); persistedConsumes++;
    assert.deepEqual(world.snapshot(owner.roomId)!.match!.teamLives, lives, 'CAS commits before life effect');
    commits.push({id, quantity, lives, savedOwned: store.inventory(account.accountId).records[0].ownedQuantity});
    return accepted;
  }});
  const owner = world.createAndJoin('owned-team-life-ai', 1, 7, 'Owned team life AI', 'Owner', 1);
  world.bindInventory(owner.playerId, store.inventory(account.accountId));
  for (let i = 0; i < 3; i++) world.manageCpu(owner.playerId, 1, 'ADD', 1);
  world.configureAutopilot(owner.playerId, 1, true); world.ready(owner.playerId, 1);
  const players = (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(owner.roomId)!.players;
  const local = players.get(owner.playerId)!;
  const ordinary = {sequence: 1000, move: -1, turn: 1, aim: 0, fire: false, useItem: 5, clientTime: now};
  assert.deepEqual(world.updateInput(owner.playerId, ordinary), [], 'Manual useItem isolated while autonomous');
  const uses: WorldEvent[] = [], rounds: object[] = [];
  let initialLives: number[] = [], hits = 0, deaths = 0, ownDeaths = 0, revivals = 0;
  for (let round = 1; round <= 2; round++) {
    if (round === 2) world.rematch(owner.playerId, 1);
    initialLives = [...world.snapshot(owner.roomId)!.match!.teamLives];
    const expected = [...initialLives], stockBefore = world.inventory(owner.playerId).records[0].ownedQuantity;
    let roundUses = 0, roundDeaths = 0;
    for (let tick = 0; tick < 6400 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
      now += 50; const events = world.step(50).events;
      for (const event of events) {
        assert.notEqual(event.type, 'itemRejected');
        if (event.type === 'hit') hits++;
        if (event.type === 'destroy') {
          const target = players.get(event.targetId!)!; expected[target.team]--; deaths++; roundDeaths++;
          if (target.team === local.team) ownDeaths++;
        }
        if (event.type === 'respawn' && event.playerId === local.id) revivals++;
        if (event.type !== 'itemUsed') continue;
        assert.equal(event.playerId, local.id); assert.equal(event.skillId, 501); assert.equal(event.value, 1);
        assert(ownDeaths > 0 && expected[local.team] < initialLives[local.team]);
        assert.equal(local.input.useItem, 5); expected[local.team]++;
        uses.push(event); roundUses++;
        assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3 - uses.length);
        assert.equal(world.inventory(local.id).records[0].ownedQuantity, 3 - uses.length);
      }
      assert.deepEqual(world.snapshot(owner.roomId)!.match!.teamLives, expected,
        'Natural team deaths subtract one; accepted autonomous501 adds one');
    }
    assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED'); assert(roundDeaths > 0);
    rounds.push({round, initialLives, stockBefore, roundUses, roundDeaths, finalLives: expected,
      remaining: world.inventory(owner.playerId).records[0]});
  }
  assert.equal(uses.length, 3); assert.equal(persistedConsumes, 3);
  assert(hits > 0 && deaths > 0 && ownDeaths > 0 && revivals > 0);
  world.leave(owner.playerId); store.close(); store = new AccountStore(database);
  const persisted = store.inventory(account.accountId);
  assert.equal(persisted.records[0].ownedQuantity, 0); assert.equal(persisted.hotkeys[3], 77);
  assert.equal(persisted.records[0].float24Bits, 0x7fc01234);
  const rejoined = world.createAndJoin('owned-team-life-ai', 1, 7, 'Rejoin', 'Owner', 1);
  world.bindInventory(rejoined.playerId, persisted);
  world.manageCpu(rejoined.playerId, 1, 'ADD', 1); world.ready(rejoined.playerId, 1);
  assert.equal(world.snapshot(rejoined.roomId)!.phase, 'PLAYING');
  world.configureAutopilot(rejoined.playerId, 1, true);
  for (let i = 0; i < 25; i++) {now += 50; assert(!world.step(50).events.some(e => ['itemUsed', 'itemRejected'].includes(e.type)));}
  world.configureAutopilot(rejoined.playerId, 1, false);
  const before = world.snapshot(rejoined.roomId)!.players[0];
  world.updateInput(rejoined.playerId, {...ordinary, sequence: 1, move: 1, turn: 0, useItem: 0});
  now += 50; world.step(50);
  const after = world.snapshot(rejoined.roomId)!.players[0];
  assert(Math.hypot(after.x - before.x, after.z - before.z) > 0);
  assert.equal((world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(rejoined.roomId)!.players.get(rejoined.playerId)!.input.sequence, 1);
  world.leave(rejoined.playerId);
  writeFileSync('recovery/output/team-life-ai-world.json', JSON.stringify({status: 'PASS', uses, commits, rounds,
    hits, deaths, ownDeaths, revivals, persistedConsumes, persisted,
    manualDisplacement: Math.hypot(after.x - before.x, after.z - before.z),
    scope: 'Explicit initial account ownership; ordinary Autopilot and automatic501 after natural team deaths, two full mode1/map7 rounds, exact life accounting, finite stock CAS-before-effect, store reopen/exhausted reentry and sequence1 manual recovery. Read-only battle observation; rebuilt AI eligibility.'}, null, 2));
  console.log('PASS: account team-life AI natural-loss casts, persistent CAS, two rounds and manual recovery');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
