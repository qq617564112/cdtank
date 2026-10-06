import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {World} from '../apps/server/src/world';
import {AccountStore} from '../apps/server/src/account-store';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-team-life-world-'));
const database = join(directory, 'accounts.sqlite');
let store = new AccountStore(database);
try {
  const account = store.open();
  store.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 501, ownedQuantity: 3,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  store.assign(account.accountId, 77, 4);
  let now = 100000, refuseCas = true, sequence = 0;
  const commits: object[] = [];
  const world: World = new World(() => now, {consumeItem: (_id, instance, quantity, definition): boolean => {
    const lives = [...world.snapshot(host.roomId)!.match!.teamLives];
    const saved = store.consumeItem(account.accountId, instance, quantity + (refuseCas ? 1 : 0), definition);
    assert.deepEqual(world.snapshot(host.roomId)!.match!.teamLives, lives,
      'Life increase must follow the account commit');
    commits.push({saved, expectedOwned: quantity, livesBeforeCommit: lives,
      savedOwned: store.inventory(account.accountId).records[0].ownedQuantity});
    return saved;
  }});
  const host = world.createAndJoin('team-life', 1, 7, 'Team life', 'Owner', 1);
  world.bindInventory(host.playerId, store.inventory(account.accountId));
  for (let index = 0; index < 3; index++) world.manageCpu(host.playerId, 1, 'ADD', 1);
  world.ready(host.playerId, 1);
  const snapshot = () => world.snapshot(host.roomId)!;
  const local = () => snapshot().players.find(player => player.id === host.playerId)!;
  const input = (useItem = 5, inputSequence = ++sequence) => world.updateInput(host.playerId,
    {sequence: inputSequence, move: 0, turn: 0, aim: 0, fire: false, useItem, clientTime: now});
  const initialLives = [...snapshot().match!.teamLives];
  assert(input().some(event => event.type === 'itemRejected'));
  assert.deepEqual(snapshot().match!.teamLives, initialLives);
  assert.equal(world.inventory(host.playerId).records[0].ownedQuantity, 3);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3);
  refuseCas = false;
  const rounds: object[] = [];
  for (let round = 1; round <= 2; round++) {
    if (round === 2) world.rematch(host.playerId, 1);
    assert.equal(snapshot().phase, 'PLAYING');
    assert(local().alive);
    const before = [...snapshot().match!.teamLives], team = local().team;
    const ownedBefore = world.inventory(host.playerId).records[0].ownedQuantity;
    assert.equal(ownedBefore, 4 - round, 'Rematch must preserve finite account stock');
    assert.equal(world.inventory(host.playerId).records[0].battleQuantity, 2, 'Source battlemax limits each round to two');
    const used = input().find(event => event.type === 'itemUsed');
    assert(used); assert.equal(used.value, 1); assert.equal(used.skillId, 501);
    assert.equal(used.playSkillEffect?.skillId, 501);
    const afterCast = [...snapshot().match!.teamLives];
    assert.equal(afterCast[team], before[team] + 1);
    assert.equal(afterCast[1 - team], before[1 - team]);
    assert.equal(world.inventory(host.playerId).records[0].ownedQuantity, ownedBefore - 1);
    assert(!input(5, sequence).some(event => event.type === 'itemUsed'));
    assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, ownedBefore - 1);
    let hits = 0, deaths = 0, ownTeamDeaths = 0, deadRefused = false;
    const expectedLives = [...afterCast];
    for (let tick = 0; tick < 6400 && snapshot().phase === 'PLAYING'; tick++) {
      now += 50;
      const events = world.step(50).events;
      for (const event of events) {
        if (event.type === 'hit') {hits++; assert(event.value > 0);}
        if (event.type === 'destroy') {
          const target = snapshot().players.find(player => player.id === event.targetId)!;
          expectedLives[target.team]--; deaths++;
          if (target.team === team) ownTeamDeaths++;
        }
      }
      assert.deepEqual(snapshot().match!.teamLives, expectedLives,
        'Natural projectile deaths must consume exactly one team life');
      if (!local().alive && snapshot().phase === 'PLAYING' && !deadRefused) {
        const stock = world.inventory(host.playerId).records[0].ownedQuantity;
        assert(!input().some(event => event.type === 'itemUsed'));
        assert.equal(world.inventory(host.playerId).records[0].ownedQuantity, stock);
        deadRefused = true;
      }
    }
    assert.equal(snapshot().phase, 'FINISHED');
    assert(hits > 0 && deaths > 0 && ownTeamDeaths > 0);
    rounds.push({round, used, before, afterCast, hits, deaths, ownTeamDeaths, deadRefused,
      finalLives: snapshot().match!.teamLives, result: snapshot().match!.result,
      remaining: world.inventory(host.playerId).records[0]});
  }
  world.leave(host.playerId);
  const wrongMode = world.createAndJoin('wrong-mode', 4, 7, 'Melee', 'Owner', 1);
  world.bindInventory(wrongMode.playerId, store.inventory(account.accountId));
  world.manageCpu(wrongMode.playerId, 1, 'ADD', 1); world.ready(wrongMode.playerId, 1);
  const rejected = world.updateInput(wrongMode.playerId, {sequence: 1, move: 0, turn: 0, aim: 0,
    fire: false, useItem: 5, clientTime: now});
  assert(!rejected.some(event => event.type === 'itemUsed'));
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 1);
  assert.equal(world.inventory(wrongMode.playerId).records[0].ownedQuantity, 1);
  store.close(); store = new AccountStore(database);
  const persisted = store.inventory(account.accountId);
  assert.equal(persisted.records[0].ownedQuantity, 1); assert.equal(persisted.hotkeys[3], 77);
  assert.equal(persisted.records[0].float24Bits, 0x7fc01234);
  writeFileSync('recovery/output/team-life-world.json', JSON.stringify({status: 'PASS', commits, rounds,
    wrongModeRejected: true, persisted,
    scope: 'Explicit pre-match account seed; ordinary World useItem5, real CPU projectiles/deaths, two natural rounds, CAS refusal and account-store reopen. No battle-state writes; eligibility and persistence are rebuilt server rules.'}, null, 2));
  console.log('PASS: team life ordinary casts, two natural CPU rounds/death accounting, CAS-before-effect, duplicate/mode refusal and persistent stock');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
