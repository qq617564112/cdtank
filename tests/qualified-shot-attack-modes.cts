import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';

const source = 'recovery/output/permanent-barrel-attack-network-2026-10-05T21-38-35-170Z';
const directory = mkdtempSync(join(tmpdir(), 'cdtank-qualified-attack-modes-'));
const database = join(directory, 'accounts.sqlite');
copyFileSync(source + '-checkpoint.sqlite', database);
const store = new AccountStore(database);
const accountId = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts[0].accountId as string;
const cases: unknown[] = [];
let hostHits = 0;
try {
  for (const [mode, mapId] of [[1, 7], [2, 2], [3, 2], [4, 7], [5, 20]]) {
    let now = 100000;
    const world = new World(() => now);
    const joined = world.createAndJoin('qualified-mode-' + mode, mode, mapId, '炮管对战', 'Owner', 3);
    world.bindInventory(joined.playerId, store.inventory(accountId));
    world.bindRoleSources(joined.playerId, store.selectedRoleSources(accountId));
    world.bindEquipmentProfile(joined.playerId, store.roleProfile(accountId));
    for (let index = 0; index < 3; index++) world.manageCpu(joined.playerId, 1, 'ADD', 1);
    world.configureAutopilot(joined.playerId, 1, true);
    world.ready(joined.playerId, 1);
    const rounds: unknown[] = [];
    for (let round = 1; round <= 2; round++) {
      if (round === 2) world.rematch(joined.playerId, 1);
      assert.equal(world.roleAttributes(joined.playerId).armorReady, true);
      assert(world.roleAttributes(joined.playerId).recoveredArmor!.selectedSkillIds.includes(13001));
      let hits = 0, fires = 0, deaths = 0;
      for (let tick = 0; tick < 7000 && world.snapshot(joined.roomId)!.phase === 'PLAYING'; tick++) {
        now += 50;
        for (const event of world.step(50).events) {
          if (event.type === 'fire' && event.playerId === joined.playerId) fires++;
          if (event.type === 'hit' && event.playerId === joined.playerId) {
            assert.equal(event.value, 196); hits++; hostHits++;
          }
          if (event.type === 'destroy') deaths++;
        }
      }
      const final = world.snapshot(joined.roomId)!;
      assert.equal(final.phase, 'FINISHED'); assert(final.match?.result);
      assert(fires > 0, 'Qualified owner must fire through ordinary autonomous inputs');
      const result = structuredClone(final.match.result);
      now += 1000; world.step(1000);
      assert.deepEqual(world.snapshot(joined.roomId)!.match!.result, result);
      rounds.push({round, fires, hits, deaths, result});
    }
    world.leave(joined.playerId);
    assert.equal(world.snapshot(joined.roomId), undefined);
    cases.push({mode, mapId, rounds, normalLeaveRemovedRoom: true});
    console.log('PASS: qualified barrel attack mode ' + mode + ' two natural rounds');
  }
  assert(hostHits > 0);
  writeFileSync('recovery/output/qualified-shot-attack-modes.json', JSON.stringify({
    status: 'PASS_QUALIFIED_ATTACK_FIVE_MODES_TWO_NATURAL_SIMULATED_ROUNDS_SCOPE',
    source: source + '-checkpoint.sqlite', fixture: 'Copied real owned account; three normal CPU participants; no live position/HP/kill injection',
    simulationTickSeconds: .05, realtimeNetworkProved: false, cases, hostHits,
  }, null, 2) + '\n');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
