import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {BattleRoleSources} from '../apps/server/src/battle-role-sources';
import {World} from '../apps/server/src/world';
import {writeRoleProfileEquipment} from '../apps/server/src/accounts/profile/equipment';
import {writeRoleProfileCosmetic} from '../apps/server/src/accounts/profile/cosmetics';

const evidence: {rows: {before: number[]; after: number[]; kind: 'skin' | 'mark'; value: number}[]} =
  JSON.parse(readFileSync('recovery/output/role-profile-cosmetics-native.json', 'utf8'));
const empty = {decorationInstanceId: 0, marks: [0, 0, 0], parts: [0, 0, 0, 0, 0]};
for (const row of evidence.rows) {
  const profile = {bytes: new Uint8Array(row.before), strings: ['', ''] as [string, string]};
  const expected = (bytes: Uint8Array) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return {decorationInstanceId: view.getUint32(0x118, true),
      marks: Array.from({length: 3}, (_, slot) => view.getUint32(0x13c + slot * 4, true)),
      parts: Array.from({length: 5}, (_, slot) => view.getUint32(0x148 + slot * 4, true))};
  };
  const sources = new BattleRoleSources();
  assert(sources.replaceProfile(profile));
  assert.deepEqual(sources.equipment(), expected(profile.bytes));
  assert(!sources.replaceProfile(profile));
  writeRoleProfileCosmetic(profile, row.kind, row.value);
  assert.deepEqual([...profile.bytes], row.after);
  sources.replaceProfile(profile);
  assert.deepEqual(sources.equipment(), expected(new Uint8Array(row.after)));
  const snapshot = sources.equipment();
  snapshot.marks.fill(0); snapshot.parts.fill(0); snapshot.decorationInstanceId = 0;
  profile.bytes.fill(0);
  assert.deepEqual(sources.equipment(), expected(new Uint8Array(row.after)), 'Profile and output mutation cannot change bound state');
  assert(sources.replaceProfile(undefined));
  assert.deepEqual(sources.equipment(), empty);
  assert(!sources.replaceProfile(undefined));
}

let now = 100000;
const world = new World(() => now, {timeLimitSeconds: 1});
const host = world.createAndJoin('equipment-host', 4, 7, '装备来源', 'Host', 1);
const guest = world.joinRoom(host.roomId, 'equipment-guest', 'Guest', 1);
const profile = {bytes: new Uint8Array(0x170), strings: ['', ''] as [string, string]};
const view = new DataView(profile.bytes.buffer);
writeRoleProfileEquipment(profile, [0xf1234567, 0x80000000, 0xffffffff, 0, 81]);
writeRoleProfileCosmetic(profile, 'skin', 82);
view.setUint32(0x140, 0x80000000, true); view.setUint32(0x144, 0xffffffff, true);
writeRoleProfileCosmetic(profile, 'mark', 83);
const configured = {decorationInstanceId: 82, marks: [83, 0x80000000, 0xffffffff],
  parts: [0xf1234567, 0x80000000, 0xffffffff, 0, 81]};
world.bindEquipmentProfile(host.playerId, profile);
assert.deepEqual(world.equipmentSources(host.playerId), configured, 'Room profile retains unsigned owned instances');
assert.deepEqual(world.battlePartSources(host.playerId), {tableIds: [0, 0, 0, 0, 0], passiveSkillIds: []},
  'A profile without owned inventory records cannot supply battle part definitions');
assert.deepEqual(world.equipmentSources(guest.playerId), empty);
world.ready(host.playerId, 1);
const ready = () => world.snapshot(host.roomId)!.match!.readyPlayerIds.includes(host.playerId);
assert(ready());
world.bindEquipmentProfile(host.playerId, profile);
assert(ready(), 'Unchanged profile preserves preparation');
writeRoleProfileCosmetic(profile, 'skin', 84);
world.bindEquipmentProfile(host.playerId, profile);
assert(!ready(), 'Decoration alone changes acknowledged loadout');
world.ready(host.playerId, 1);
writeRoleProfileCosmetic(profile, 'mark', 85);
world.bindEquipmentProfile(host.playerId, profile);
assert(!ready(), 'Mark changes acknowledged loadout');
world.ready(host.playerId, 1);
writeRoleProfileEquipment(profile, [0, 0x80000000, 0xffffffff, 0, 81]);
world.bindEquipmentProfile(host.playerId, profile);
assert(!ready(), 'Part unload changes acknowledged loadout');
const confirmed = {decorationInstanceId: 84, marks: [85, 0x80000000, 0xffffffff],
  parts: [0, 0x80000000, 0xffffffff, 0, 81]};
world.ready(host.playerId, 1); world.ready(guest.playerId, 1);
assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
assert.deepEqual(world.equipmentSources(host.playerId), confirmed, 'Start retains source equipment arrays');
assert.deepEqual(world.battlePartSources(host.playerId).tableIds, [0, 0, 0, 0, 0]);
profile.bytes.fill(0);
assert.throws(() => world.bindEquipmentProfile(host.playerId, profile));
assert.deepEqual(world.equipmentSources(host.playerId), confirmed);
now += 1000; world.step(1000);
assert.equal(world.snapshot(host.roomId)!.phase, 'FINISHED');
assert.throws(() => world.bindEquipmentProfile(host.playerId, undefined));
world.rematch(host.playerId, 1); world.rematch(guest.playerId, 1);
assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
assert.deepEqual(world.equipmentSources(host.playerId), confirmed);
world.leave(host.playerId);
assert.throws(() => world.equipmentSources(host.playerId));
const again = world.createAndJoin('equipment-host', 4, 7, '装备重入', 'Host', 1);
assert.deepEqual(world.equipmentSources(again.playerId), empty);
world.bindEquipmentProfile(again.playerId, profile);
assert.deepEqual(world.equipmentSources(again.playerId), empty, 'Clear persisted equipment does not reuse previous room state');
const cpu = world.manageCpu(again.playerId, 1, 'ADD', 1);
assert.deepEqual(world.equipmentSources(cpu), empty);
writeFileSync('recovery/output/account-battle-equipment-sources.json', JSON.stringify({status: 'PASS',
  nativeProfileRows: evidence.rows.length, profileInstancesPreserved: true, missingInventoryNoBattleParts: true, unsignedInstances: true,
  trailingMarkWords: true, detachedProfileAndReads: true, partMarkDecorationClearReady: true,
  unchangedPreservesReady: true, startAndRematchRetain: true, playingFinishedFrozen: true,
  leaveRejoinClears: true, cpuNoGrants: true,
  scope: 'Recovered profile instance fields populate detached authoritative room equipment sources. Missing owned inventory produces no battle part definitions. Original profile-to-battle transfer, mark conversion, full attribute recompute and attachment rendering remain unproven.'}, null, 2) + '\n');
console.log(`PASS: ${evidence.rows.length} native profile vectors → detached equipment sources; ownership gates, preparation, freeze, rematch and cleanup`);
