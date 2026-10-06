import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';

// Explicit owned source fixture; no battle state or result injection.
const rows = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows;
const row = rows.find((value: {tankId: number; part: number}) => value.tankId === 1 && value.part === 0);
const fields = (values: Record<string, number>) => new Map(Object.entries(values)
  .map(([offset, value]) => [Number(offset), value]));
const sources = {base: {name: 'Imported owned pet', fields: fields(row.base)},
  equipment: {name: 'Imported owned tank', fields: fields(row.equipment)}};
const profile = {bytes: new Uint8Array(0x170), strings: ['', ''] as [string, string]};
const world = new World(() => 100000);
const host = world.createAndJoin('finished-host', 1, 7, 'Finished account binding', 'Host', 1);
const guest = world.joinRoom(host.roomId, 'finished-guest', 'Guest', 1);
world.bindRoleSources(guest.playerId, sources);
world.bindEquipmentProfile(guest.playerId, profile);
world.ready(host.playerId, 1);
world.ready(guest.playerId, 1);
assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
assert.throws(() => world.bindRoleSources(guest.playerId, sources), /准备阶段/);
assert.throws(() => world.bindEquipmentProfile(guest.playerId, profile), /准备阶段/);
world.leave(host.playerId); // Ordinary departure commits the existing forfeit rule.
const finished = world.snapshot(host.roomId)!;
assert.equal(finished.phase, 'FINISHED');
const result = JSON.stringify(finished.match!.result);
const guestAttributes = world.roleAttributes(guest.playerId);
assert.throws(() => world.bindRoleSources(guest.playerId, sources), /准备阶段/);
assert.throws(() => world.bindEquipmentProfile(guest.playerId, profile), /准备阶段/);
assert.deepEqual(world.roleAttributes(guest.playerId), guestAttributes);

const newcomer = world.joinRoom(host.roomId, 'finished-new-connection', 'Rejoined', 1);
world.bindInventory(newcomer.playerId, {hotkeys: [0, 0, 0, 77, 0, 0, 0], records: [{
  instanceId: 77, itemTableId: 1, ownedQuantity: 1, battleQuantity: 0, state: 0,
  field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0,
}]});
world.bindRoleSources(newcomer.playerId, sources);
world.bindEquipmentProfile(newcomer.playerId, profile);
assert.equal(world.roleAttributes(newcomer.playerId).ready, true);
assert.equal(world.roleAttributes(newcomer.playerId).maxHp, guestAttributes.maxHp);
assert.equal(world.chat(newcomer.playerId, '正常重入后的聊天', 0)[0].message, 'Rejoined: 正常重入后的聊天');
assert.equal(JSON.stringify(world.snapshot(host.roomId)!.match!.result), result);
world.rematch(guest.playerId, 1);
assert.equal(world.snapshot(host.roomId)!.phase, 'FINISHED');
world.rematch(newcomer.playerId, 1);
const second = world.snapshot(host.roomId)!;
assert.equal(second.phase, 'PLAYING');
assert.equal(second.match!.round, 2);
assert(second.players.every(player => player.hp === player.maxHp));
assert.equal(world.inventory(newcomer.playerId).records[0].battleQuantity, 1);
assert.throws(() => world.bindRoleSources(newcomer.playerId, sources), /准备阶段/);
assert.throws(() => world.bindEquipmentProfile(newcomer.playerId, profile), /准备阶段/);
world.leave(newcomer.playerId);
world.leave(guest.playerId);
writeFileSync('recovery/output/room-finished-account.json', JSON.stringify({status: 'PASS',
  scope: 'Ordinary Ready, departure-forfeit, fresh FINISHED admission, owned account binding and consensus rematch. No battle state injection.',
  frozenResult: JSON.parse(result), originalMaxHp: guestAttributes.maxHp,
  secondRound: second.match!.round, preservedInventory: 1,
  existingSourceRefusals: 4, activeSourceRefusals: 4}, null, 2));
console.log('PASS: new FINISHED member account binding, existing source freeze, unchanged settlement and ordinary round2 inventory/source initialization');
