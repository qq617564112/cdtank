import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {consumableShopItems} from '../apps/server/src/accounts/shop-catalog';
import {passiveCopyCandidates, copyPassiveSkillAfterKill, clearCopiedRoleSkill} from '../apps/server/src/battle/passive-skill-copy';
import {recomputeBattleAttributes} from '../apps/server/src/battle/attributes';
import {setBattleHealth} from '../apps/server/src/battle/health';
import {applyHealingItem} from '../apps/server/src/battle/healing';
import type {PlayerState} from '../apps/server/src/battle/player-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const source = 'recovery/output/browser-old-bomb-2026-10-06T01-12-58-627Z';
const directory = mkdtempSync(join(tmpdir(), 'cdtank-copy-consumer-'));
const database = join(directory, 'accounts.sqlite');
copyFileSync(source + '-checkpoint.sqlite', database);
const identities = JSON.parse(readFileSync(source + '-checkpoint-fixture.json', 'utf8')).accounts as {accountId: string}[];
const setup = new DatabaseSync(database);
for (const [index, account] of identities.entries()) {
  const row = setup.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(account.accountId)!;
  const bytes = Uint8Array.from(row.payload as Uint8Array);
  new DataView(bytes.buffer).setUint32(0x80, index === 0 ? 200 : 10, true);
  setup.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, account.accountId);
}
setup.close();
const store = new AccountStore(database);
try {
  for (const [index, account] of identities.entries()) {
    const purchased = store.petShop(account.accountId, {operation: 'BUY', petId: index === 0 ? 102 : 103,
      currency: 'MONEY', requestId: 'copy-consumer-pet-' + index}).purchased!;
    const instanceId = new Map(purchased.fields).get(0)!;
    store.selectRole(account.accountId, 'pet', instanceId);
    store.petSkillLearning(account.accountId, {operation: 'LEARN', slot: 0, instanceId,
      requestId: 'copy-consumer-learn-' + index}, combatCatalog);
  }
  const food = store.shop(identities[0].accountId, consumableShopItems(combatCatalog),
    {operation: 'BUY', itemTableId: 1, quantity: 2, currency: 'MONEY', requestId: 'copy-consumer-food'}).purchased!;
  store.assign(identities[0].accountId, food.instanceId, 4);
  let now = 100000;
  const world = new World(() => now);
  const host = world.createAndJoin('copy-host', 4, 7, '模仿', 'Copy', 3);
  const peer = world.joinRoom(host.roomId, 'copy-peer', 'Food', 3);
  for (const [index, entry] of [host, peer].entries()) {
    const id = identities[index].accountId;
    world.bindInventory(entry.playerId, store.inventory(id));
    world.bindRoleSources(entry.playerId, store.selectedRoleSources(id));
    world.bindEquipmentProfile(entry.playerId, store.roleProfile(id));
  }
  world.ready(host.playerId, 1); world.ready(peer.playerId, 1);
  const room = (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(host.roomId)!;
  const attacker = room.players.get(host.playerId)!, target = room.players.get(peer.playerId)!;
  assert.deepEqual(passiveCopyCandidates(target), [{baseId: 10811, rank: 1}]);
  const ownedBefore = structuredClone(store.roleRecords(identities[0].accountId));
  const baseRate = attacker.combat.roleFloatFields.get(0x8c)!;
  assert.equal(baseRate, 0);
  let rolls = 0;
  const roll = () => {rolls++; return .75;};
  assert.equal(copyPassiveSkillAfterKill(attacker, target, 4, roll), false, 'A living target is not a final kill');
  assert.equal(rolls, 0);
  // Direct consumer fixtures isolate the completed-kill state from realtime match evidence.
  target.alive = false;
  attacker.team = target.team;
  assert.equal(copyPassiveSkillAfterKill(attacker, target, 1, roll), false, 'A friendly kill does not copy');
  const health = attacker.hp, bullets = attacker.combat.bulletCount;
  assert(copyPassiveSkillAfterKill(attacker, target, 4, roll));
  assert.equal(rolls, 1);
  recomputeBattleAttributes(attacker);
  assert.equal(attacker.hp, health); assert.equal(attacker.combat.bulletCount, bullets);
  assert.equal(attacker.combat.roleFloatFields.get(0x8c), Math.fround(20 * Math.fround(.01)));
  assert(world.snapshot(host.roomId)!.players.find(p => p.id === host.playerId)!.roleSkillSources!.selectedSkillIds.includes(10811));
  setBattleHealth(attacker, 100);
  const events: MsgRoomEvent[] = [];
  applyHealingItem(host.roomId, attacker, {kind: 'useItem', instanceId: food.instanceId},
    () => attacker.attributes.record.maxHp, () => true, events);
  assert.equal(events.at(-1)!.type, 'itemUsed'); assert.equal(events.at(-1)!.value, 240);
  assert.equal(attacker.hp, 340);
  assert(clearCopiedRoleSkill(attacker.combat)); recomputeBattleAttributes(attacker);
  assert.equal(attacker.hp, 340); assert.equal(attacker.combat.roleFloatFields.get(0x8c), 0);
  assert(!world.snapshot(host.roomId)!.players.find(p => p.id === host.playerId)!.roleSkillSources!.selectedSkillIds.includes(10811));
  setBattleHealth(attacker, 100);
  applyHealingItem(host.roomId, attacker, {kind: 'useItem', instanceId: food.instanceId},
    () => attacker.attributes.record.maxHp, () => true, events);
  assert.equal(events.at(-1)!.value, 200); assert.equal(attacker.hp, 300);
  assert.deepEqual(store.roleRecords(identities[0].accountId), ownedBefore);
  attacker.alive = false;
  assert.equal(copyPassiveSkillAfterKill(attacker, target, 4, roll), false);
  assert.equal(rolls, 1);
  const fields = target.ownedRoles.snapshot().base!.fields;
  const candidateSource = {ownedRoles: {snapshot: () => ({base: {fields: new Map(fields)
    .set(0x44, 10211).set(0x5c, 1).set(0x48, 10221).set(0x60, 1)}})}};
  assert.deepEqual(passiveCopyCandidates(candidateSource as unknown as PlayerState), [], 'Kill-healing and conditional skills are excluded');
  attacker.alive = true;
  attacker.combat.record!.numericFields!.set(0x88, 10812);
  attacker.combat.record!.numericFields!.set(0x8c, 2);
  assert.equal(copyPassiveSkillAfterKill(attacker,
    {...target, ownedRoles: candidateSource.ownedRoles} as unknown as PlayerState, 4, roll), false);
  assert.equal(attacker.combat.record!.numericFields!.get(0x88), 10812, 'An empty candidate set keeps the current source');
  assert.equal(rolls, 1);
  clearCopiedRoleSkill(attacker.combat); recomputeBattleAttributes(attacker);
  target.alive = true; target.combat.setStatus(2); setBattleHealth(target, 1);
  const deathEvents: MsgRoomEvent[] = [];
  const authority = world as unknown as {applyPlayerDamage(room: unknown, owner: PlayerState,
    target: PlayerState, damage: number, events: MsgRoomEvent[]): void};
  authority.applyPlayerDamage(room, attacker, target, 10, deathEvents);
  assert.equal(deathEvents.filter(e => e.type === 'destroy').length, 1);
  assert.equal(attacker.combat.roleFloatFields.get(0x8c), Math.fround(20 * Math.fround(.01)), 'The World death commit recomputes the copied source');
  assert.equal(attacker.hp, 300); assert.equal(attacker.combat.bulletCount, bullets);
  target.alive = true; target.combat.setStatus(2); setBattleHealth(target, target.attributes.record.maxHp);
  setBattleHealth(attacker, 1);
  authority.applyPlayerDamage(room, target, attacker, 10, deathEvents);
  assert.equal(attacker.alive, false);
  assert.equal(attacker.combat.record!.numericFields!.get(0x88), 0, 'Final death clears the copied source');
  assert.equal(attacker.combat.roleFloatFields.get(0x8c), 0);
  now += 3000; world.step(50);
  assert.equal(attacker.alive, true);
  assert.equal(attacker.combat.roleFloatFields.get(0x8c), 0, 'Natural respawn retains the original source');
  target.alive = false;
  assert(copyPassiveSkillAfterKill(attacker, target, 4, roll)); recomputeBattleAttributes(attacker);
  (world as unknown as {startRoom(room: unknown): void}).startRoom(room);
  assert.equal(attacker.combat.record!.numericFields!.get(0x88), 0, 'Round initialization clears the source before recomputation');
  assert.equal(attacker.combat.roleFloatFields.get(0x8c), 0);
  target.alive = false;
  assert(copyPassiveSkillAfterKill(attacker, target, 4, roll));
  world.leave(host.playerId);
  assert.equal(attacker.combat.record!.numericFields!.get(0x88), 0, 'Leave clears the transient source');
  writeFileSync('recovery/output/passive-skill-copy-consumer.json', JSON.stringify({status: 'PASS_FINITE_PASSIVE_COPY_SOURCE_RECOMPUTE_FOOD240_CLEAR200_NO_FREE_HP_AMMO_OR_OWNED_WRITE_SCOPE',
    fixture: 'Legal checkpoint clone, pre-service non-earned Point200/10, ordinary BUY102/103 and LEARN; direct completed-kill and injured-life consumer fixtures',
    copied: {baseId: 10811, rank: 1}, restoredWithCopy: 240, restoredAfterClear: 200,
    authorityRolls: rolls, worldFinalDeathCommitRecomputed: true, deathRespawnRoundLeaveCleared: true,
    noFreeHealthOrAmmo: true, ownedUnchanged: true, realtimeMatchProved: false}, null, 2) + '\n');
  console.log('PASS passive copy source, recompute, food consumer and clear');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
