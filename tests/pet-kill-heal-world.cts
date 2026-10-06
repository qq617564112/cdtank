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

const source = 'recovery/output/browser-contact-mine-2026-10-06T02-08-40-962Z';
const directory = mkdtempSync(join(tmpdir(), 'cdtank-kill-heal-'));
const database = join(directory, 'accounts.sqlite');
copyFileSync(source + '-checkpoint.sqlite', database);
const identities = JSON.parse(readFileSync(source + '-checkpoint-fixture.json', 'utf8')).accounts as {accountId: string}[];
const setup = new DatabaseSync(database), learnerId = identities[1].accountId;
const row = setup.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(learnerId)!;
const bytes = Uint8Array.from(row.payload as Uint8Array);
new DataView(bytes.buffer).setUint32(0x80, 10, true);
setup.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, learnerId);
setup.close();
const store = new AccountStore(database);
try {
  store.selectRole(learnerId, 'pet', 3);
  let now = 100000;
  function match() {
    const world = new World(() => now);
    const host = world.createAndJoin('heal-host', 4, 7, '击毁恢复', 'Target', 3);
    const peer = world.joinRoom(host.roomId, 'heal-peer', 'Learner', 3);
    for (const [index, entry] of [host, peer].entries()) {
      const id = identities[index].accountId;
      world.bindInventory(entry.playerId, store.inventory(id));
      world.bindRoleSources(entry.playerId, store.selectedRoleSources(id));
      world.bindEquipmentProfile(entry.playerId, store.roleProfile(id));
    }
    world.ready(host.playerId, 1); world.ready(peer.playerId, 1);
    const room = (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(host.roomId)!;
    const attacker = room.players.get(peer.playerId)!, target = room.players.get(host.playerId)!;
    const authority = world as unknown as {applyPlayerDamage(room: unknown, owner: PlayerState,
      target: PlayerState, damage: number, events: MsgRoomEvent[]): void};
    return {world, room, attacker, target, authority};
  }
  let {world, room, attacker, target, authority} = match();
  const events: MsgRoomEvent[] = [];
  setBattleHealth(attacker, 500); setBattleHealth(target, 1);
  authority.applyPlayerDamage(room, attacker, target, 10, events);
  assert.equal(attacker.hp, 500); assert(!events.some(e => e.skillId === 10211));
  now += 3000; world.step(50); assert(target.alive);
  const learned = store.petSkillLearning(learnerId, {operation: 'LEARN', instanceId: 3, slot: 0,
    requestId: 'kill-heal-world-learn'}, combatCatalog);
  ({world, room, attacker, target, authority} = match());
  const owned = structuredClone(store.roleRecords(learnerId)), profile = store.roleProfile(learnerId);
  setBattleHealth(attacker, 500); setBattleHealth(target, 1);
  const ammo = attacker.combat.bulletCount;
  authority.applyPlayerDamage(room, attacker, target, 10, events);
  assert.equal(attacker.hp, 540); assert.equal(attacker.combat.bulletCount, ammo);
  assert.equal(events.filter(e => e.skillId === 10211).length, 1);
  authority.applyPlayerDamage(room, attacker, target, 10, events);
  assert.equal(attacker.hp, 540); assert.equal(events.filter(e => e.skillId === 10211).length, 1);
  now += 3000; world.step(50); assert(target.alive);
  store.selectRole(identities[0].accountId, 'pet', 13);
  ({world, room, attacker, target, authority} = match());
  setBattleHealth(attacker, 500); setBattleHealth(target, 1);
  authority.applyPlayerDamage(room, attacker, target, 10, events);
  assert(target.alive && target.hp === 0 && target.lastStand);
  assert.equal(attacker.hp, 500);
  for (let i = 0; i < 59; i++) {now += 50; world.step(50);}
  assert(target.alive); assert.equal(attacker.hp, 500);
  now += 50; world.step(50);
  assert(!target.alive); assert.equal(attacker.hp, 540);
  now += 50; world.step(50); assert.equal(attacker.hp, 540);
  assert.deepEqual(store.roleRecords(learnerId), owned); assert.deepEqual(store.roleProfile(learnerId), profile);
  writeFileSync('recovery/output/pet-kill-heal-world.json', JSON.stringify({
    status: 'PASS_10211_WORLD_FINAL_DEATH_COMMIT_UNLEARNED_LEARNED_DELAYED_UNIQUE_HEAL',
    scope: 'Legal cloned accounts with declared pre-service Point10 and explicit damage/life fixtures',
    ordinarySelectAndLearn: learned, unlearnedHeal: 0, learnedHeal: 40,
    pendingHeal: 0, finalDelayedHeal: 40, repeatedDeadDamageDoesNotHeal: true,
    ownedProfileAndAmmoPreserved: true,
  }, null, 2) + '\n');
  console.log('PASS: 10211 World final death commit and delayed last stand death');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
