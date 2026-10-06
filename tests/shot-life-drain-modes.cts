import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';

const source = process.argv[2];
assert(source, 'Explicit accepted learned Pet104 network source stem is required');
const accepted = JSON.parse(readFileSync(source + '.json', 'utf8'));
const qualification = accepted.sourceQualification.find((row: {completed: boolean; roleFloats: [number, number][]}) =>
  row.completed && new Map(row.roleFloats).get(0x94)! > 0);
assert(qualification, 'Actual learned source must have completed original attributes');
const floats = new Map<number, number>(qualification.roleFloats);
const integers = new Map<number, number>(qualification.roleIntegers);
const rate = floats.get(0x94)!;
const rawAttack = Math.round(integers.get(0x70)! * floats.get(0x74)! + integers.get(0x78)!);
const directory = mkdtempSync(join(tmpdir(), 'cdtank-life-drain-modes-'));
const database = join(directory, 'accounts.sqlite');
copyFileSync(source + '-checkpoint.sqlite', database);
const store = new AccountStore(database);
const accountId = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts[0].accountId as string;
const cases: unknown[] = [];
let hostHits = 0, absorptions = 0, absorbedHp = 0, foodUses = 0;
try {
  for (const [mode, mapId] of [[1, 7], [2, 2], [3, 2], [4, 7], [5, 20]]) {
    let now = 100000;
    const world = new World(() => now);
    const joined = world.createAndJoin('life-drain-mode-' + mode, mode, mapId, '吸血对战', 'Owner', 3);
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
      if (mode === 3) {
        assert.equal(qualified, false, 'VIP original multiplier is unresolved; life drain qualification stays withdrawn');
      } else {
        assert.equal(qualified, true);
        assert.equal(attributes.roleFloats!['148'], rate);
      }
      assert(attributes.recoveredArmor!.selectedSkillIds.includes(10911));
      let hits = 0, heals = 0, deaths = 0;
      for (let tick = 0; tick < 7000 && world.snapshot(joined.roomId)!.phase === 'PLAYING'; tick++) {
        const before = world.snapshot(joined.roomId)!;
        const hp = new Map(before.players.map(player => [player.id, player.hp]));
        const maximum = new Map(before.players.map(player => [player.id, player.maxHp]));
        let pendingHeal = 0;
        now += 50;
        for (const event of world.step(50).events) {
          if (event.type === 'respawn') hp.set(event.playerId, maximum.get(event.playerId)!);
          if (event.type === 'itemUsed' && (event.skillId === 1 || event.skillId === 2)) {
            hp.set(event.playerId, Math.min(maximum.get(event.playerId)!,
              hp.get(event.playerId)! + event.value) | 0);
            foodUses++;
          }
          if (event.type === 'hit') {
            const previous = hp.get(event.targetId)!;
            const next = Math.max(0, (previous - event.value) | 0);
            hp.set(event.targetId, next);
            if (event.playerId === joined.playerId) {
              assert.equal(event.value, rawAttack); hits++; hostHits++;
              const priorAttacker = hp.get(joined.playerId)!;
              pendingHeal = qualified && priorAttacker > 0 ? Math.min(maximum.get(joined.playerId)! - priorAttacker,
                Math.round((previous - next) * rate)) : 0;
            }
          }
          if (event.type === 'playerHealed') {
            assert.equal(event.playerId, joined.playerId);
            assert.equal(event.targetId, joined.playerId);
            assert.equal(event.value, pendingHeal);
            assert(event.value > 0);
            hp.set(joined.playerId, hp.get(joined.playerId)! + event.value);
            pendingHeal = 0; heals++; absorptions++; absorbedHp += event.value;
          }
          if (event.type === 'destroy') deaths++;
        }
        assert.equal(pendingHeal, 0, 'Every positive absorption must publish its actual recovery');
        for (const player of world.snapshot(joined.roomId)!.players) assert.equal(player.hp, hp.get(player.id));
      }
      const final = world.snapshot(joined.roomId)!;
      assert.equal(final.phase, 'FINISHED'); assert(final.match?.result);
      const result = structuredClone(final.match.result);
      now += 1000; world.step(1000);
      assert.deepEqual(world.snapshot(joined.roomId)!.match!.result, result);
      rounds.push({round, qualified, hits, heals, deaths, result});
    }
    world.leave(joined.playerId);
    assert.equal(world.snapshot(joined.roomId), undefined);
    cases.push({mode, mapId, rounds, normalLeaveRemovedRoom: true});
    console.log('PASS: qualified life drain mode ' + mode + ' two natural rounds');
  }
  assert(hostHits > 0 && absorptions > 0);
  writeFileSync('recovery/output/shot-life-drain-modes.json', JSON.stringify({
    status: 'PASS_QUALIFIED_LIFE_DRAIN_FIVE_MODES_TWO_NATURAL_SIMULATED_ROUNDS_SCOPE',
    source: source + '-checkpoint.sqlite', fixture: 'Copied real purchased learned account; three normal CPU participants; no live position/HP/kill injection',
    simulationTickSeconds: .05, realtimeNetworkProved: false, cases, hostHits, absorptions, absorbedHp, foodUses,
  }, null, 2) + '\n');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
