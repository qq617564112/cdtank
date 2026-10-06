import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeBattleQuantities, resolveItemHotkey, type BattleItemRecord, type HotkeyCommand} from '../apps/shared/combat/item-hotkeys';
import {World} from '../apps/server/src/world';

const evidence: {rows: Array<{slot: number; itemTableId: number; quantity: number;
  has_controller?: boolean; has_role?: boolean; assigned?: boolean; found?: boolean; has_array?: boolean;
  result: {accepted: boolean; command: HotkeyCommand}}>;
  quantities: Array<{owned: number; limit: number; assigned: boolean; usable: number}>}
  = JSON.parse(readFileSync('recovery/output/combat-item-hotkeys-native.json', 'utf8'));
for (const row of evidence.rows) {
  const record = {instanceId: 77, itemTableId: row.itemTableId, ownedQuantity: 999, battleQuantity: row.quantity};
  const result = resolveItemHotkey(row.slot, row.has_controller !== false,
    row.has_array === false ? undefined : new Int32Array(7).fill(row.assigned === false ? 0 : 77),
    row.found === false ? [] : [record],
    row.has_role !== false);
  assert.deepEqual(result, row.result, `Original dispatcher slot${row.slot} item${row.itemTableId}`);
  assert.equal(record.battleQuantity, row.quantity, 'Request dispatch cannot consume inventory');
}
for (const row of evidence.quantities) {
  const record = {instanceId: 77, itemTableId: 2001, ownedQuantity: row.owned, battleQuantity: 99};
  initializeBattleQuantities(new Int32Array(7).fill(row.assigned ? 77 : 0), [record], () => row.limit);
  assert.equal(record.battleQuantity, row.usable);
  assert.equal(record.ownedQuantity, row.owned);
}
const records: BattleItemRecord[] = [
  {instanceId: 71, itemTableId: 2001, ownedQuantity: 3, battleQuantity: 99},
  {instanceId: 72, itemTableId: 3001, ownedQuantity: 400, battleQuantity: 99},
  {instanceId: 73, itemTableId: 12501, ownedQuantity: 10, battleQuantity: 99},
];
initializeBattleQuantities([71, 72, 0, 0, 0, 0, 0], records, () => 255);
assert.deepEqual(records.map(record => record.battleQuantity), [3, 255, 99]);
assert.deepEqual(records.map(record => record.ownedQuantity), [3, 400, 10]);

const world = new World(() => 100000, {minPlayers: 2});
const room = world.listRooms().find(room => room.mode === 1)!;
const a = world.joinRoom(room.id, 'hotkey-a', 'A', 1);
const b = world.joinRoom(room.id, 'hotkey-b', 'B', 1);
const selected = () => world.snapshot(room.id)!.players.find(player => player.id === a.playerId)!.selectedAmmoSlot;
const input = (sequence: number, useItem: number) => ({sequence, useItem,
  move: 0, turn: 0, aim: 0, fire: false, clientTime: 0});
world.updateInput(a.playerId, input(1, 1));
assert.equal(selected(), 1, 'Waiting input cannot select ammo');
world.ready(a.playerId, 1); world.ready(b.playerId, 1);
for (const slot of [2, 3, 4, 5, 6, 7, 8, 9]) {
  world.updateInput(a.playerId, input(slot, slot));
  assert.equal(selected(), 1, 'Empty owned hotkeys and invalid slots must not select or use items');
}
world.updateInput(a.playerId, input(9, 1));
assert.equal(selected(), 1, 'A stale input cannot apply a shortcut');
world.updateInput(a.playerId, input(10, 1));
assert.equal(selected(), 1);
assert.equal(world.snapshot(room.id)!.players.find(player => player.id === b.playerId)!.selectedAmmoSlot, 1);
assert.equal(world.step(50).events.length, 0, 'Ammo selection must not fire, score or grant inventory');
console.log(`PASS: ${evidence.rows.length} native hotkey decisions, owned/usable quantity separation, World default ammo shortcut and stale/waiting/empty-slot inputs`);
