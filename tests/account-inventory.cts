import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-account-'));
const path = join(directory, 'accounts.sqlite');
let store = new AccountStore(path);
try {
  const first = store.open(), second = store.open();
  assert.notEqual(first.accountId, second.accountId);
  assert.deepEqual(store.inventory(first.accountId), {records: [], hotkeys: Array(7).fill(0)});
  assert.throws(() => store.open('invalid'));
  const item: InventoryWireRecord = {instanceId: 0xf1234567, itemTableId: 2001,
    ownedQuantity: 3, battleQuantity: 0, state: 0, field8: 7,
    float24Bits: 0x7fc01234, float28Bits: 0x80000000, float2cBits: 0xffffffff};
  store.replaceInventory(first.accountId, [item]);
  assert.throws(() => store.assign(second.accountId, item.instanceId, 1));
  assert.throws(() => store.assign(first.accountId, item.instanceId, 4));
  assert.throws(() => store.assign(first.accountId, item.instanceId, 0));
  const configured = store.assign(first.accountId, item.instanceId, 1);
  assert.equal(configured.result, 4);
  assert.equal(configured.hotkeys[0], item.instanceId);
  assert.deepEqual(store.inventory(first.accountId).records, [item]);
  store.close(); store = new AccountStore(path);
  assert.deepEqual(store.open(first.token), first);
  assert.equal(store.inventory(first.accountId).hotkeys[0], item.instanceId);
  assert.deepEqual(store.inventory(first.accountId).records, [item]);
  let now = 100000;
  const world = new World(() => now);
  const owner = world.createAndJoin('owner', 4, 7, 'Inventory test', 'Owner', 1);
  world.bindInventory(owner.playerId, store.inventory(first.accountId));
  assert(world.canConfigureInventory(owner.playerId));
  for (let index = 0; index < 3; index++) world.manageCpu(owner.playerId, 1, 'ADD', 1);
  world.ready(owner.playerId, 1);
  assert.equal(world.snapshot(owner.roomId)!.phase, 'PLAYING');
  assert.equal(world.canConfigureInventory(owner.playerId), false);
  world.updateInput(owner.playerId, {sequence: 1, move: 0, turn: 0, aim: 0, fire: false, useItem: 2, clientTime: now});
  assert.equal(world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!.selectedAmmoSlot, 2);
  assert.equal(store.inventory(first.accountId).records[0].ownedQuantity, 3);
  const cancellation = store.cancel(first.accountId, 1);
  assert.equal(cancellation.result, 1);
  assert.equal(store.inventory(first.accountId).hotkeys[0], 0);
  store.assign(first.accountId, item.instanceId, 1);
  store.replaceInventory(first.accountId, []);
  assert.equal(store.inventory(first.accountId).hotkeys[0], 0);
  assert.deepEqual(store.inventory(second.accountId).records, []);
  writeFileSync('recovery/output/account-inventory.json', JSON.stringify({status: 'PASS',
    scope: 'Rebuilt persistent empty account identity, explicit fixture import, unsigned inventory/float payload preservation, owned kitbag validation, restart recovery and normal World ammo selection; no grants, consumption or recovered original authentication.',
    accountIsolation: true, restartRecovery: true, normalAmmoSelection: true}, null, 2));
  console.log('PASS: persistent account identity, inventory isolation, source request gates, seven-slot save/restart, normal World ammo selection');
} finally {
  store.close(); rmSync(directory, {recursive: true, force: true});
}
