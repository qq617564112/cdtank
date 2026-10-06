import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';
import {resolveBattlePartTableIds} from '../apps/server/src/battle/roles/part-definitions';
import {World} from '../apps/server/src/world';
import {writeRoleProfileEquipment} from '../apps/server/src/accounts/profile/equipment';

const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const items = new Map(catalog.items.map(item => [item.itemTableId, item]));
const evidence: {traversals: {sources: {currentSkillIds?: number[]; itemIds?: number[]}; selected: number[]}[]} =
  JSON.parse(readFileSync('recovery/output/combat-role-skills-native.json', 'utf8'));
const nativeRows = evidence.traversals.filter(row => row.sources.itemIds &&
  row.sources.itemIds[0] > 13000 && row.sources.itemIds[0] <= 18000 &&
  row.sources.currentSkillIds?.every(id => id === 0));
assert(nativeRows.length > 0);
const record = (instanceId: number, itemTableId: number): InventoryWireRecord => ({
  instanceId, itemTableId, ownedQuantity: 1, battleQuantity: 0, state: 2, field8: 0,
  float24Bits: 0, float28Bits: 0, float2cBits: 0});
const profile = {bytes: new Uint8Array(0x170), strings: ['', ''] as [string, string]};
let now = 100000;
const world = new World(() => now, {timeLimitSeconds: 1});
const host = world.createAndJoin('part-host', 4, 7, 'Part definitions', 'Host', 1);
const guest = world.joinRoom(host.roomId, 'part-guest', 'Guest', 1);
let accepted = 0, rejected = 0;
for (const item of catalog.items) {
  const inventory = [record(0xf1234567, item.itemTableId)];
  const eligible = item.itemTableId > 13000 && item.itemTableId <= 18000;
  const expected = eligible ? item.itemTableId : 0;
  assert.deepEqual(resolveBattlePartTableIds([0xf1234567, 0, 0, 0, 0], inventory, items), [expected, 0, 0, 0, 0]);
  world.bindInventory(host.playerId, {records: inventory, hotkeys: Array(7).fill(0)});
  writeRoleProfileEquipment(profile, [0xf1234567, 0, 0, 0, 0]);
  world.bindEquipmentProfile(host.playerId, profile);
  assert.deepEqual(world.battlePartSources(host.playerId).tableIds, [expected, 0, 0, 0, 0]);
  assert.deepEqual(world.equipmentSources(host.playerId).parts, [0xf1234567, 0, 0, 0, 0]);
  if (eligible) accepted++; else rejected++;
}
for (const row of nativeRows) {
  const tableId = row.sources.itemIds![0];
  // Original traversal supplies this table twice; map two distinct owned instances into two battle slots.
  world.bindInventory(host.playerId, {records: [record(0x80000000, tableId), record(0xffffffff, tableId)], hotkeys: Array(7).fill(0)});
  writeRoleProfileEquipment(profile, [0x80000000, 0, 0, 0, 0xffffffff]);
  world.bindEquipmentProfile(host.playerId, profile);
  assert.deepEqual(world.battlePartSources(host.playerId), {
    tableIds: [tableId, 0, 0, 0, tableId], passiveSkillIds: row.selected,
  }, 'Room inventory → actual battle table slots → original passive selection including duplicates');
}
const tableId = nativeRows.find(row => row.selected.length > 0)!.sources.itemIds![0];
const good = record(0xf1234567, tableId);
writeRoleProfileEquipment(profile, [good.instanceId, 0, 0, 0, 0]);
world.bindInventory(host.playerId, {records: [good], hotkeys: Array(7).fill(0)});
world.bindEquipmentProfile(host.playerId, profile);
assert.equal(world.battlePartSources(host.playerId).tableIds[0], tableId);
world.ready(host.playerId, 1);
const ready = () => world.snapshot(host.roomId)!.match!.readyPlayerIds.includes(host.playerId);
assert(ready());
world.bindInventory(host.playerId, {records: [{...good}], hotkeys: Array(7).fill(0)});
assert(ready(), 'Unchanged inventory preserves acknowledged part definitions');
for (const invalid of [{...good, ownedQuantity: 0}, {...good, state: 0}, {...good, state: 1},
  {...good, state: 255}, {...good, itemTableId: 0xffffffff}, {...good, itemTableId: 10001}]) {
  world.bindInventory(host.playerId, {records: [invalid], hotkeys: Array(7).fill(0)});
  assert.deepEqual(world.battlePartSources(host.playerId), {tableIds: [0, 0, 0, 0, 0], passiveSkillIds: []});
  assert.deepEqual(world.equipmentSources(host.playerId).parts, [good.instanceId, 0, 0, 0, 0]);
}
assert(!ready(), 'Changed effective definition cancels readiness even when profile instance is unchanged');
world.bindInventory(host.playerId, {records: [], hotkeys: Array(7).fill(0)});
assert.equal(world.battlePartSources(host.playerId).tableIds[0], 0);
// An instance numerically equal to a table ID must still resolve its own definition.
const secondTableId = nativeRows.find(row => row.sources.itemIds![0] !== tableId)!.sources.itemIds![0];
world.bindInventory(host.playerId, {records: [record(tableId, secondTableId)], hotkeys: Array(7).fill(0)});
writeRoleProfileEquipment(profile, [tableId, 0, 0, 0, 0]);
world.bindEquipmentProfile(host.playerId, profile);
assert.equal(world.battlePartSources(host.playerId).tableIds[0], secondTableId);
assert.deepEqual(world.battlePartSources(guest.playerId), {tableIds: [0, 0, 0, 0, 0], passiveSkillIds: []});
const before = world.battlePartSources(host.playerId);
before.tableIds.fill(0); before.passiveSkillIds.fill(0);
assert.equal(world.battlePartSources(host.playerId).tableIds[0], secondTableId);
const confirmed = world.battlePartSources(host.playerId);
world.ready(host.playerId, 1); world.ready(guest.playerId, 1);
assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
assert.deepEqual(world.battlePartSources(host.playerId), confirmed);
assert.throws(() => world.bindEquipmentProfile(host.playerId, undefined));
now += 1000; world.step(1000);
world.rematch(host.playerId, 1); world.rematch(guest.playerId, 1);
assert.deepEqual(world.battlePartSources(host.playerId), confirmed);
writeFileSync('recovery/output/account-battle-part-definitions.json', JSON.stringify({status: 'PASS',
  catalogItems: catalog.items.length, acceptedPartDefinitions: accepted, rejectedOtherCategories: rejected,
  nativeSelectionRows: nativeRows.length, highUnsignedOwnedInstances: true, quantitiesAndStatesGate: true,
  unknownDefinitionNoFallback: true, instanceTableCollision: true, accountRoomIsolation: true,
  inventoryChangeRebinds: true, unchangedReadyPreserved: true, startRematchRetain: true,
  scope: 'Rebuilt ownership/state2/quantity/category boundary. Actual World part array2 contains ItemTable IDs consumed by original43372d..43376b; original passive selection vectors match. Does not implement full attribute recompute or establish original server transfer rules.'}, null, 2) + '\n');
console.log(`PASS: ${catalog.items.length} owned item categories; ${nativeRows.length} native passive selection vectors via World battle part definitions`);
