import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';

const source = process.argv[2];
assert(source, 'Explicit actual ordinary purchased equipped reactive armor source stem required');
const accepted = JSON.parse(readFileSync(source + '.json', 'utf8'));
assert.equal(accepted.status, 'PASS_FINITE_ORDINARY_REACTIVE_ARMOR17071_FIRST_BLOCK_SECOND_DAMAGE_READY_DUAL_STATE_NATIVE_RESTART_SCOPE');
assert.equal(accepted.counterSource.maximum, 1);
const directory = mkdtempSync(join(tmpdir(), 'cdtank-counter-modes-'));
const database = join(directory, 'accounts.sqlite');
copyFileSync(source + '-checkpoint.sqlite', database);
const store = new AccountStore(database);
const accountId = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts[0].accountId as string;
const cases: unknown[] = [];
let blocks = 0, damagingHits = 0, respawns = 0;
try {
  for (const [mode, mapId] of [[1, 7], [2, 2], [3, 2], [4, 7], [5, 20]]) {
    let now = 100000;
    const world = new World(() => now);
    const joined = world.createAndJoin('counter-mode-' + mode, mode, mapId, '反应装甲', 'Owner', 3);
    world.bindInventory(joined.playerId, store.inventory(accountId));
    world.bindRoleSources(joined.playerId, store.selectedRoleSources(accountId));
    world.bindEquipmentProfile(joined.playerId, store.roleProfile(accountId));
    for (let index = 0; index < 3; index++) world.manageCpu(joined.playerId, 1, 'ADD', 1);
    world.configureAutopilot(joined.playerId, 1, true);
    world.ready(joined.playerId, 1);
    const rounds: unknown[] = [];
    for (let round = 1; round <= 2; round++) {
      if (round === 2) world.rematch(joined.playerId, 1);
      const attributes = world.roleAttributes(joined.playerId);
      const qualified = attributes.ready;
      if (mode === 3) assert.equal(qualified, false, 'VIP multiplier gap withdraws counter qualification');
      else {
        assert.equal(qualified, true);
        assert.equal(attributes.roleIntegers!['88'], 1);
      }
      assert(attributes.recoveredArmor!.selectedSkillIds.includes(13161));
      let spent = 0, roundBlocks = 0, roundDamage = 0, roundRespawns = 0;
      for (let tick = 0; tick < 7000 && world.snapshot(joined.roomId)!.phase === 'PLAYING'; tick++) {
        const before = world.snapshot(joined.roomId)!;
        const hp = new Map(before.players.map(player => [player.id, player.hp]));
        const maximum = new Map(before.players.map(player => [player.id, player.maxHp]));
        now += 50;
        for (const event of world.step(50).events) {
          if (event.type === 'respawn') {
            hp.set(event.playerId, maximum.get(event.playerId)!);
            if (event.playerId === joined.playerId) {spent = 0; roundRespawns++; respawns++;}
          }
          if (event.type === 'itemUsed' && (event.skillId === 1 || event.skillId === 2)) {
            hp.set(event.playerId, Math.min(maximum.get(event.playerId)!, hp.get(event.playerId)! + event.value) | 0);
          }
          if (event.type === 'hit') {
            if (event.targetId === joined.playerId) {
              if (event.value === 0) {
                assert.equal(qualified, true); assert.equal(spent, 0);
                assert.notEqual(event.playerId, joined.playerId);
                const shooter = before.players.find(player => player.id === event.playerId)!;
                const victim = before.players.find(player => player.id === event.targetId)!;
                assert.equal(mode <= 3 && shooter.team === victim.team, false);
                assert.equal(event.hurtSelector, undefined);
                spent++; roundBlocks++; blocks++;
              } else {roundDamage++; damagingHits++;}
            }
            hp.set(event.targetId, Math.max(0, (hp.get(event.targetId)! - event.value) | 0));
          }
          if (event.type === 'playerHealed') {
            assert.equal(event.playerId, joined.playerId); assert.equal(event.targetId, joined.playerId);
            hp.set(event.targetId, hp.get(event.targetId)! + event.value);
          }
        }
        for (const player of world.snapshot(joined.roomId)!.players) assert.equal(player.hp, hp.get(player.id));
      }
      const final = world.snapshot(joined.roomId)!;
      assert.equal(final.phase, 'FINISHED'); assert(final.match?.result);
      const result = structuredClone(final.match.result);
      now += 1000; world.step(1000);
      assert.deepEqual(world.snapshot(joined.roomId)!.match!.result, result);
      if (!qualified) assert.equal(roundBlocks, 0);
      rounds.push({round, qualified, blocks: roundBlocks, damagingHits: roundDamage, respawns: roundRespawns, result});
    }
    world.leave(joined.playerId);
    assert.equal(world.snapshot(joined.roomId), undefined);
    cases.push({mode, mapId, rounds, normalLeaveRemovedRoom: true});
    console.log('PASS: qualified cancellation mode ' + mode + ' two natural rounds');
  }
  assert(blocks > 0 && damagingHits > 0 && respawns > 0);
  writeFileSync('recovery/output/shot-cancellation-modes.json', JSON.stringify({
    status: 'PASS_QUALIFIED_PER_LIFE_CANCELLATION_FIVE_MODES_TWO_NATURAL_SIMULATED_ROUNDS_SCOPE',
    source: source + '-checkpoint.sqlite', fixture: 'Real ordinary purchased equipped account; three normal CPU participants; no live HP/position/kill injection',
    simulationTickSeconds: .05, realtimeNetworkProved: false, cases, blocks, damagingHits, respawns,
  }, null, 2) + '\n');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
