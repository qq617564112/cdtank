import assert from 'node:assert/strict';
import {BattleItemInventory} from '../apps/web/src/match/battle-item-inventory';
import type {ResInventory} from '../apps/shared/protocols/PtlInventory';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';

async function main() {
  const requests: {resolve(value: ResInventory): void; reject(error: Error): void}[] = [];
  const inventory = new BattleItemInventory(() => new Promise((resolve, reject) => {
    requests.push({resolve, reject});
  }));
  const snapshot = (roomId: string, round: number, phase = 'PLAYING') =>
    ({roomId, phase, match: {round}} as MsgRoomSnapshot);
  const event = (type: string, playerId = 'P1', roomId = 'R1') =>
    ({type, playerId, roomId} as MsgRoomEvent);
  const stock = (quantity: number): ResInventory => ({hotkeys: [7], records: [{instanceId: 7,
    itemTableId: 6, ownedQuantity: quantity, battleQuantity: quantity, state: 0,
    field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]});
  const flush = async () => {await Promise.resolve(); await Promise.resolve();};

  inventory.update(snapshot('R1', 1), 'P1');
  inventory.update(snapshot('R1', 1), 'P1');
  assert.equal(requests.length, 1, 'Snapshot ticks never poll');
  inventory.event(event('itemRejected'));
  inventory.event(event('itemUsed', 'P2'));
  inventory.event(event('ammoConsumed', 'P1', 'R2'));
  assert.equal(requests.length, 1, 'Rejected, remote and foreign-room events do not refresh');
  requests[0].resolve(stock(2)); await flush();
  assert.equal(inventory.getSnapshot().inventory?.records[0].battleQuantity, 2);

  inventory.event(event('itemUsed'));
  inventory.event(event('ammoConsumed'));
  assert.equal(requests.length, 2, 'Refreshes serialize');
  requests[1].resolve(stock(1)); await flush();
  assert.equal(requests.length, 3);
  assert.equal(inventory.getSnapshot().inventory?.records[0].battleQuantity, 2,
    'Response started before a later consumption does not publish stale stock');
  requests[2].resolve(stock(0)); await flush();
  assert.equal(inventory.getSnapshot().inventory?.records[0].battleQuantity, 0);

  inventory.event(event('itemUsed'));
  inventory.clear();
  inventory.update(snapshot('R2', 1), 'P2');
  requests[3].resolve(stock(99)); await flush();
  assert.equal(inventory.getSnapshot().inventory, undefined, 'Old room response is discarded');
  requests[4].resolve(stock(3)); await flush();
  assert.equal(inventory.getSnapshot().inventory?.records[0].battleQuantity, 3);
  inventory.update(snapshot('R2', 2), 'P2');
  assert.equal(inventory.getSnapshot().inventory, undefined, 'New round clears previous inventory');
  requests[5].reject(new Error('disconnected')); await flush();
  assert.equal(inventory.getSnapshot().inventory, undefined, 'Failed read leaves no invented stock');
  inventory.update(snapshot('R2', 2), 'P2');
  assert.equal(requests.length, 6, 'Read failure does not trigger per-tick retry');
  inventory.event(event('itemUsed', 'P2', 'R2'));
  inventory.update(snapshot('R2', 2, 'WAITING'), 'P2');
  requests[6].resolve(stock(8)); await flush();
  assert.equal(inventory.getSnapshot().inventory, undefined, 'Waiting and late response remain clear');
  console.log('PASS: confirmed inventory lifecycle, consumption refresh, serialization and late-response isolation');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
