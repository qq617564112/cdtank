import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {writeRoleProfileEquipment} from '../apps/server/src/accounts/profile/equipment';

const rows = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows as {
  base: Record<string, number>; equipment: Record<string, number>; tankId: number; part: number;
  values: {recordFields: Record<string, number>};
}[];
const fields = (record: Record<string, number>) => new Map(Object.entries(record).map(([key, value]) => [Number(key), value]));
let cases = 0;
for (const row of rows) {
  const world = new World();
  const host = world.createAndJoin('prepare-owner', 4, 7, '装备生命', 'Owner', row.tankId);
  const guest = world.joinRoom(host.roomId, 'prepare-peer', 'Peer', 1);
  const peerBefore = world.snapshot(host.roomId)!.players.find(player => player.id === guest.playerId)!;
  const health = () => world.snapshot(host.roomId)!.players.find(player => player.id === host.playerId)!;
  world.bindRoleSources(host.playerId, {base: {name: 'Owned pet', fields: fields(row.base)},
    equipment: {name: 'Owned tank', fields: fields(row.equipment)}});
  assert.equal(health().hp, health().maxHp, 'Owned source binding cannot leave prototype life above or below the acknowledged maximum');
  const profile = {bytes: new Uint8Array(0x170), strings: ['', ''] as [string, string]};
  const inventory = {hotkeys: Array(7).fill(0), records: row.part ? [{instanceId: 81, itemTableId: row.part,
    ownedQuantity: 1, battleQuantity: 0, state: 2, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}] : []};
  world.bindInventory(host.playerId, inventory);
  world.ready(host.playerId, 1);
  writeRoleProfileEquipment(profile, [row.part ? 81 : 0, 0, 0, 0, 0]);
  world.bindEquipmentProfile(host.playerId, profile);
  const player = health();
  assert.equal(player.maxHp, row.values.recordFields['88']);
  assert.equal(player.hp, player.maxHp, 'Acknowledged equipment publishes full preparation life');
  assert.deepEqual(world.snapshot(host.roomId)!.players.find(value => value.id === guest.playerId), peerBefore,
    'A loadout change does not alter another participant');
  if (row.part) {
    assert(!world.snapshot(host.roomId)!.match!.readyPlayerIds.includes(host.playerId));
    writeRoleProfileEquipment(profile, [0, 0, 0, 0, 0]);
    world.bindEquipmentProfile(host.playerId, profile);
    const withoutPart = rows.find(value => value.tankId === row.tankId && !value.part)!;
    assert.equal(health().hp, withoutPart.values.recordFields['88']);
    assert.equal(health().hp, health().maxHp, 'Removing an equipped part also synchronizes life');
  }
  world.bindRoleSources(host.playerId, {base: undefined, equipment: undefined});
  assert(!world.roleAttributes(host.playerId).ready);
  assert.equal(health().hp, health().maxHp, 'Withdrawing sources publishes the explicit fallback consistently');
  cases++;
}
let now = 100000;
const world = new World(() => now, {timeLimitSeconds: 20});
const row = rows.find(value => value.tankId === 2 && !value.part)!;
const host = world.createAndJoin('refresh-owner', 4, 7, '库存刷新', 'Owner', 2);
world.bindRoleSources(host.playerId, {base: {name: 'Owned pet', fields: fields(row.base)},
  equipment: {name: 'Owned tank', fields: fields(row.equipment)}});
world.manageCpu(host.playerId, 1, 'ADD', 1);
world.manageCpu(host.playerId, 1, 'ADD', 105);
world.configureAutopilot(host.playerId, 1, true);
world.ready(host.playerId, 1);
let wounded = world.snapshot(host.roomId)!.players.find(player => player.id === host.playerId)!;
for (let tick = 0; tick < 390 && !(wounded.alive && wounded.hp < wounded.maxHp); tick++) {
  now += 50;
  world.step(50);
  wounded = world.snapshot(host.roomId)!.players.find(player => player.id === host.playerId)!;
}
assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
assert(wounded.alive && wounded.hp > 0 && wounded.hp < wounded.maxHp, 'Ordinary CPU fire must create a wounded participant');
world.bindInventory(host.playerId, {hotkeys: Array(7).fill(0), records: []});
const refreshed = world.snapshot(host.roomId)!.players.find(player => player.id === host.playerId)!;
assert.equal(refreshed.hp, wounded.hp, 'A real battle inventory binding cannot heal a wounded participant');
assert.equal(refreshed.maxHp, wounded.maxHp);
writeFileSync('recovery/output/preparation-health-rules.json', JSON.stringify({status: 'PASS', cases,
  sourceBinding: true, equipUnequip: true, readiness: true, participantIsolation: true, sourceWithdrawal: true,
  liveBinding: {beforeHp: wounded.hp, afterHp: refreshed.hp, maxHp: refreshed.maxHp}}, null, 2));
console.log(`PASS ${cases} preparation loadouts`);
