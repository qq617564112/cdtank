import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {setBattleHealth} from '../apps/server/src/battle/health';
import type {PlayerState} from '../apps/server/src/battle/player-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const source = 'recovery/output/browser-pet-kill-heal-2026-10-06T02-23-56-449Z';
const directory = mkdtempSync(join(tmpdir(), 'cdtank-hit-speed-'));
const database = join(directory, 'accounts.sqlite');copyFileSync(source + '-checkpoint.sqlite', database);
const identities = JSON.parse(readFileSync(source + '-checkpoint-fixture.json', 'utf8')).accounts as {accountId: string}[];
const learner = identities[1].accountId;
const setup = new DatabaseSync(database), row = setup.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(learner)!;
const bytes = Uint8Array.from(row.payload as Uint8Array);new DataView(bytes.buffer).setUint32(0x80, 10, true);
setup.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, learner);setup.close();
const store = new AccountStore(database);
try {
  let now = 100000;
  function match() {
    const world = new World(() => now);
    const host = world.createAndJoin('speed-host', 4, 7, '受击移动', 'Attacker', 3);
    const peer = world.joinRoom(host.roomId, 'speed-peer', 'Learner', 3);
    for (const [index, entry] of [host, peer].entries()) {
      const id = identities[index].accountId;
      world.bindInventory(entry.playerId, store.inventory(id));
      world.bindRoleSources(entry.playerId, store.selectedRoleSources(id));
      world.bindEquipmentProfile(entry.playerId, store.roleProfile(id));
    }
    world.ready(host.playerId, 1);world.ready(peer.playerId, 1);
    const room = (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(host.roomId)!;
    const attacker = room.players.get(host.playerId)!, target = room.players.get(peer.playerId)!;
    const authority = world as unknown as {applyPlayerDamage(room: unknown, owner: PlayerState,
      target: PlayerState, damage: number, events: MsgRoomEvent[]): void};
    return {world, room, host, peer, attacker, target, authority};
  }
  let {world, room, host, peer, attacker, target, authority} = match();
  const events: MsgRoomEvent[] = [];
  const unlearnedSpeed = target.recoveredMovement!.speed;
  authority.applyPlayerDamage(room, attacker, target, 10, events);
  assert.equal(target.petHitSpeed, undefined);assert.equal(target.recoveredMovement!.speed, unlearnedSpeed);
  const learned = store.petSkillLearning(learner, {operation: 'LEARN', instanceId: 3, slot: 2,
    requestId: 'hit-speed-world-learn'}, combatCatalog);assert.equal(learned.learned!.cost, 10);
  ({world, room, host, peer, attacker, target, authority} = match());
  const inventory = store.inventory(learner), owned = store.roleRecords(learner), profile = store.roleProfile(learner);
  const base = {...target.recoveredMovement!}, ammo = target.combat.bulletCount;
  authority.applyPlayerDamage(room, attacker, target, 10, events);
  assert.equal(target.petHitSpeed!.expiresAt, now + 5000);
  assert.equal(target.recoveredMovement!.speed, base.speed + 10);
  assert.equal(target.recoveredMovement!.turn, base.turn);
  assert(world.snapshot(host.roomId)!.players.find(p => p.id === peer.playerId)!.roleSkillSources!.selectedSkillIds.includes(10231));
  const boosted = {...target.recoveredMovement!};
  now += 3000;authority.applyPlayerDamage(room, attacker, target, 10, events);
  assert.equal(target.petHitSpeed!.expiresAt, now + 5000);
  assert.equal(target.combat.record!.arrays.get(4)!.filter(id => id === 10231).length, 1);
  assert.deepEqual(target.recoveredMovement, boosted);
  now += 4999;world.step(50);assert(target.petHitSpeed);
  now += 1;world.step(50);assert.equal(target.petHitSpeed, undefined);assert.deepEqual(target.recoveredMovement, base);
  assert(!world.snapshot(host.roomId)!.players.find(p => p.id === peer.playerId)!.roleSkillSources!.selectedSkillIds.includes(10231));
  target.invincibility = {skillId: 8, expiresAt: now + 1000};
  authority.applyPlayerDamage(room, attacker, target, 10, events);assert.equal(target.petHitSpeed, undefined);delete target.invincibility;
  authority.applyPlayerDamage(room, attacker, target, 10, events);assert(target.petHitSpeed);
  setBattleHealth(target, 1);authority.applyPlayerDamage(room, attacker, target, 10, events);
  assert(!target.alive);assert.equal(target.petHitSpeed, undefined);assert.deepEqual(target.recoveredMovement, base);
  now += 3000;world.step(50);assert(target.alive);assert.equal(target.petHitSpeed, undefined);
  authority.applyPlayerDamage(room, attacker, target, 10, events);assert(target.petHitSpeed);
  world.leave(host.playerId);assert.equal(target.petHitSpeed, undefined);assert.deepEqual(target.recoveredMovement, base);
  assert.equal(target.combat.bulletCount, ammo);
  assert.deepEqual(store.inventory(learner), inventory);assert.deepEqual(store.roleRecords(learner), owned);assert.deepEqual(store.roleProfile(learner), profile);
  writeFileSync('recovery/output/pet-hit-speed-world.json', JSON.stringify({
    status: 'PASS_10231_WORLD_LEARN_INJURY_ORIGINAL_MOVE_RECOMPUTE_REFRESH_EXPIRE_DEATH_FINISH',
    scope: 'Legal learned cloned accounts with declared Point10 and explicit damage/life fixtures',
    learned: learned.learned, base, boosted, unlearnedSpeed, durationMilliseconds: 5000,
    repeatedHitSingleSkill: true, exactExpiryRestoresSource: true, immuneNoTrigger: true,
    deathRespawnAndFinishedClear: true, accountAndAmmoPreserved: true,
  }, null, 2) + '\n');
  console.log('PASS: 10231 World accepted injury, original movement, timer and lifecycle');
} finally {store.close();rmSync(directory, {recursive: true, force: true});}
