import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {BattleRoleSources} from '../apps/server/src/battle-role-sources';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-battle-role-sources-'));
const database = join(directory, 'accounts.sqlite');
let accounts = new AccountStore(database);
const rows: {raw: number[]; alignment: number}[] = JSON.parse(
  readFileSync('recovery/output/role-owned-pair-native.json', 'utf8')).rows;
try {
  const owner = accounts.open(), other = accounts.open();
  let tablePairs = 0;
  for (const tank of TANKS) {
    for (const pet of PET_BASES) {
      const pair = readOwnedRolePairMessage(new Uint8Array(rows[tablePairs % rows.length].raw),
        rows[tablePairs % rows.length].alignment, bytes => Buffer.from(bytes).toString('hex'));
      // Explicit imported ownership fixture: definitions are supplied, never granted from catalogs.
      const base = {name: `Explicit pet ${pet.id}`, fields: new Map(pair.base.fields)};
      const equipment = {name: tank.name, fields: new Map(pair.equipment.fields)};
      base.fields.set(0, 0xf0000073); base.fields.set(8, pet.id);
      equipment.fields.set(0x1c, 0xf0000074); equipment.fields.set(0x24, tank.id);
      accounts.replaceRoleRecords(owner.accountId, {base: [base], equipment: [equipment]});
      const bytes = new Uint8Array(0x170);
      const view = new DataView(bytes.buffer);
      view.setUint32(0xa4, base.fields.get(0)!, true);
      view.setUint32(0xa8, equipment.fields.get(0x1c)!, true);
      accounts.replaceRoleProfile(owner.accountId, {bytes, strings: ['', '']});
      const roomSources = new BattleRoleSources();
      assert(roomSources.replace(accounts.selectedRoleSources(owner.accountId)));
      assert.deepEqual(roomSources.snapshot(), {base, equipment});
      assert.deepEqual(roomSources.tables(), {tank, pet});
      assert(!roomSources.replace(accounts.selectedRoleSources(owner.accountId)));
      const detached = roomSources.snapshot();
      (detached.base!.fields as Map<number, number>).clear();
      assert.deepEqual(roomSources.snapshot(), {base, equipment});
      base.fields.set(8, 0xffffffff); equipment.fields.set(0x24, 0xffffffff);
      assert.deepEqual(roomSources.tables(), {tank, pet}, 'Importer objects cannot mutate room state');
      assert(roomSources.replace({base, equipment}));
      assert.deepEqual(roomSources.tables(), {tank: undefined, pet: undefined}, 'Unknown definitions have no fallback');
      assert(roomSources.replace(accounts.selectedRoleSources(other.accountId)));
      assert.deepEqual(roomSources.snapshot(), {base: undefined, equipment: undefined});
      assert.deepEqual(roomSources.tables(), {tank: undefined, pet: undefined});
      tablePairs++;
    }
  }
  accounts.close(); accounts = new AccountStore(database);
  assert.equal(accounts.open(owner.token).accountId, owner.accountId);
  const original = accounts.selectedRoleSources(owner.accountId);
  const selectedTank = TANKS.find(tank => tank.id === original.equipment!.fields.get(0x24))!;
  let now = 100000;
  const world = new World(() => now, {timeLimitSeconds: 1});
  const host = world.createAndJoin('source-host', 4, 7, 'Owned sources', 'Host', selectedTank.id);
  const guest = world.joinRoom(host.roomId, 'source-guest', 'Guest', 1);
  world.bindRoleSources(host.playerId, original);
  assert.deepEqual(world.roleSources(host.playerId), original);
  assert.deepEqual(world.snapshot(host.roomId)!.players.find(player => player.id === host.playerId)!.tankTextures,
    {U: original.equipment!.fields.get(0x28)!, M: original.equipment!.fields.get(0x2c)!, XY: original.equipment!.fields.get(0x30)!},
    'Rebuilt room snapshot preserves explicit owned texture fields');
  assert.deepEqual(world.roleSkillSources(host.playerId), {currentSkillIds: Array(16).fill(0),
    equipmentSkills: undefined, extraSkill: {baseId: 0, rank: 0},
    itemIds: [0x58, 0x5c, 0x60].map(offset => original.equipment!.fields.get(offset)! | 0)
      .concat(Array(7).fill(0))}, 'World reads initial copied-skill/hat/balloon fields and actual arrays');
  assert.equal(world.roleSkillSources(guest.playerId), undefined, 'Missing owned equipment does not invent skill sources');
  assert.deepEqual(world.roleSourceTables(host.playerId), {tank: selectedTank,
    pet: PET_BASES.find(pet => pet.id === original.base!.fields.get(8))});
  assert.deepEqual(world.roleSources(guest.playerId), {base: undefined, equipment: undefined});
  world.ready(host.playerId, 1);
  const ready = () => world.snapshot(host.roomId)!.match!.readyPlayerIds.includes(host.playerId);
  assert(ready());
  world.bindRoleSources(host.playerId, accounts.selectedRoleSources(owner.accountId));
  assert(ready(), 'Rebinding unchanged persisted sources preserves readiness');
  const alternate = {name: 'Explicit alternate pet', fields: new Map(original.base!.fields)};
  alternate.fields.set(0, 0xf0000075); alternate.fields.set(8, PET_BASES[0].id);
  accounts.replaceRoleRecords(owner.accountId, {base: [original.base!, alternate], equipment: [original.equipment!]});
  accounts.selectRole(owner.accountId, 'pet', alternate.fields.get(0)!);
  const confirmed = accounts.selectedRoleSources(owner.accountId);
  world.bindRoleSources(host.playerId, confirmed);
  assert(!ready(), 'Changed pet invalidates previously confirmed readiness');
  assert.deepEqual(world.roleSources(host.playerId), confirmed);
  assert.equal(world.roleSourceTables(host.playerId).pet?.id, PET_BASES[0].id);
  world.ready(host.playerId, 1); world.ready(guest.playerId, 1);
  assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
  assert.throws(() => world.bindRoleSources(host.playerId, original));
  assert.deepEqual(world.roleSources(host.playerId), confirmed);
  // Changing persistence alone cannot change an already-running battle.
  accounts.selectRole(owner.accountId, 'pet', original.base!.fields.get(0)!);
  assert.deepEqual(world.roleSources(host.playerId), confirmed);
  now += 1000; world.step(1000);
  assert.equal(world.snapshot(host.roomId)!.phase, 'FINISHED');
  assert.throws(() => world.bindRoleSources(host.playerId, original));
  world.rematch(host.playerId, 1); world.rematch(guest.playerId, 1);
  assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
  assert.deepEqual(world.roleSources(host.playerId), confirmed, 'Rematch preserves confirmed room loadout');
  assert.throws(() => world.bindRoleSources(host.playerId, original));
  world.leave(host.playerId);
  assert.throws(() => world.roleSources(host.playerId));
  const rejoined = world.createAndJoin('source-host', 4, 7, 'Rejoined sources', 'Host', selectedTank.id);
  assert.deepEqual(world.roleSources(rejoined.playerId), {base: undefined, equipment: undefined});
  world.bindRoleSources(rejoined.playerId, accounts.selectedRoleSources(owner.accountId));
  assert.deepEqual(world.roleSources(rejoined.playerId), original);
  const replacementTank = TANKS.find(tank => tank.id !== selectedTank.id)!;
  world.selectTank(rejoined.playerId, replacementTank);
  assert.equal(world.roleSources(rejoined.playerId).equipment, undefined);
  assert.equal(world.roleSourceTables(rejoined.playerId).tank, undefined, 'Direct tank changes cannot retain stale owned tank records');
  assert.deepEqual(world.roleSources(rejoined.playerId).base, original.base);
  const cpu = world.manageCpu(rejoined.playerId, 1, 'ADD', 1);
  assert.deepEqual(world.roleSources(cpu), {base: undefined, equipment: undefined}, 'CPU receives no fabricated ownership');
  writeFileSync('recovery/output/account-battle-role-sources.json', JSON.stringify({status: 'PASS',
    tablePairs, parsedPairFixtures: rows.length, databaseReopen: true, detachedSnapshots: true,
    accountIsolation: true, unknownDefinitionsNoFallback: true, changedPetClearsReady: true,
    playingAndFinishedFrozen: true, rematchPreserves: true, leaveRejoinReloads: true,
    cpuNoGrants: true, scope: 'Rebuilt selected-account-source room binding, original owned-definition getters. Does not recompute battle attributes or establish independent bound gear.'}, null, 2) + '\n');
  console.log(`PASS: ${tablePairs} persisted tank/pet source bindings; World readiness, freeze, rematch and rejoin`);
} finally {
  accounts.close(); rmSync(directory, {recursive: true, force: true});
}
