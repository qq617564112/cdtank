import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {partShopItems} from '../apps/server/src/accounts/shop-catalog';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {World} from '../apps/server/src/world';

const source = 'recovery/output/shot-hurt-resistance-network-2026-10-05T23-18-45-702Z';
const directory = mkdtempSync(join(tmpdir(), 'cdtank-supply-world-'));
copyFileSync(source + '-checkpoint.sqlite', join(directory, 'accounts.sqlite'));
const store = new AccountStore(join(directory, 'accounts.sqlite'));
const accountId = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts[0].accountId as string;
const rounds: unknown[] = [];
let healCount = 0, respawnCount = 0;
try {
  const purchase = store.shop(accountId, partShopItems(combatCatalog), {operation: 'BUY',
    itemTableId: 17061, quantity: 1, currency: 'MONEY', requestId: 'supply-world'});
  assert(purchase.purchased);
  store.configureEquipment(accountId, combatCatalog, 'EQUIP', 1, purchase.purchased.instanceId);
  let now = 100000;
  const world = new World(() => now);
  const joined = world.createAndJoin('supply-world', 4, 7, '补给装置', 'Owner', 3);
  world.bindInventory(joined.playerId, store.inventory(accountId));
  world.bindRoleSources(joined.playerId, store.selectedRoleSources(accountId));
  world.bindEquipmentProfile(joined.playerId, store.roleProfile(accountId));
  for (let index = 0; index < 3; index++) world.manageCpu(joined.playerId, 1, 'ADD', 1);
  world.configureAutopilot(joined.playerId, 1, true);
  world.ready(joined.playerId, 1);
  for (let round = 1; round <= 2; round++) {
    if (round === 2) world.rematch(joined.playerId, 1);
    assert.equal(world.roleAttributes(joined.playerId).ready, true);
    const initial = world.snapshot(joined.roomId)!;
    assert.equal(initial.phase, 'PLAYING');
    assert(!initial.players.find(player => player.id === joined.playerId)!.roleSkillSources!.selectedSkillIds.includes(13171));
    let earliestHeal = now + 3000, previousHeal: number | undefined;
    let roundHeals = 0, roundRespawns = 0;
    const healing: unknown[] = [];
    for (let tick = 0; tick < 7000 && world.snapshot(joined.roomId)!.phase === 'PLAYING'; tick++) {
      const before = world.snapshot(joined.roomId)!;
      const hp = new Map(before.players.map(player => [player.id, player.hp]));
      const maxHp = new Map(before.players.map(player => [player.id, player.maxHp]));
      now += 50;
      for (const event of world.step(50).events) {
        if (event.type === 'respawn') {
          hp.set(event.playerId, maxHp.get(event.playerId)!);
          if (event.playerId === joined.playerId) {
            earliestHeal = now + 3000; previousHeal = undefined; roundRespawns++; respawnCount++;
          }
        }
        if (event.type === 'hit') hp.set(event.targetId, Math.max(0, (hp.get(event.targetId)! - event.value) | 0));
        if (event.type === 'itemUsed' && (event.skillId === 1 || event.skillId === 2)) {
          hp.set(event.playerId, Math.min(maxHp.get(event.playerId)!, hp.get(event.playerId)! + event.value) | 0);
        }
        if (event.type === 'playerHealed') {
          assert.equal(event.skillId, 13171); assert.equal(event.playerId, joined.playerId);
          assert.equal(event.targetId, joined.playerId); assert(hp.get(event.targetId)! > 0);
          assert(now >= earliestHeal);
          if (previousHeal !== undefined) assert(now - previousHeal >= 3000);
          const delta = Math.min(20, maxHp.get(event.targetId)! - hp.get(event.targetId)!);
          assert.equal(event.value, delta); assert(delta > 0);
          hp.set(event.targetId, hp.get(event.targetId)! + delta);
          healing.push({now, beforeHp: hp.get(event.targetId)! - delta, delta});
          previousHeal = now; roundHeals++; healCount++;
        }
      }
      for (const player of world.snapshot(joined.roomId)!.players) assert.equal(player.hp, hp.get(player.id));
    }
    const final = world.snapshot(joined.roomId)!;
    assert.equal(final.phase, 'FINISHED'); assert(final.match!.result);
    const result = structuredClone(final.match!.result);
    now += 6000;
    assert(!world.step(6000).events.some(event => event.type === 'playerHealed'));
    assert.deepEqual(world.snapshot(joined.roomId)!.match!.result, result);
    assert(roundHeals > 0);
    rounds.push({round, healing, roundHeals, roundRespawns, result, finishedStopsHealing: true});
  }
  assert(healCount > 0);
  world.leave(joined.playerId); assert.equal(world.snapshot(joined.roomId), undefined);
  writeFileSync('recovery/output/equipment-supply-world.json', JSON.stringify({
    status: 'PASS_EQUIPPED_SUPPLY_WORLD_TWO_NATURAL_SIMULATED_ROUNDS_HEALTH_REMATCH_FINISH_SCOPE',
    source: source + '-checkpoint.sqlite', simulationTickSeconds: .05,
    fixture: 'AccountStore BUY/EQUIP before simulated World; owner autopilot and three ordinary CPU; no live state injection',
    realtimeNetworkProved: false, respawnRequired: false, healCount, respawnCount, rounds, leaveRemovedRoom: true,
  }, null, 2) + '\n');
  console.log('PASS supply World two natural simulated rounds, health, rematch and finish');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
