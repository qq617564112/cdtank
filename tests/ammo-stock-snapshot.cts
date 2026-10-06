import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {TSBuffer} from 'tsbuffer';
import {World} from '../apps/server/src/world';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {PlayerSnapshot} from '../apps/shared/protocols';

const world = new World();
const owner = world.createAndJoin('stock-owner', 4, 7, '弹药数量', 'Owner', 1);
const instanceId = 0xf1234567;
world.bindInventory(owner.playerId, {hotkeys: [instanceId, 0, 0, 0, 0, 0, 0], records: [{
  instanceId, itemTableId: 2007, ownedQuantity: 2, battleQuantity: 99, state: 0,
  field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0,
}]});
world.ready(owner.playerId, 1);
const snapshot = world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!;
assert.deepEqual(snapshot.ammoSlots, [{slot: 2, itemTableId: 2007, quantity: 2}],
  'Unsigned owned instance selects its actual capped battle quantity');
const codec = new TSBuffer(serviceProto.types);
const encoded = codec.encode(snapshot, 'MsgRoomSnapshot/PlayerSnapshot');
assert(encoded.isSucc);
const decoded = codec.decode<PlayerSnapshot>(encoded.buf, 'MsgRoomSnapshot/PlayerSnapshot');
assert(decoded.isSucc);
assert.deepEqual(decoded.value.ammoSlots, snapshot.ammoSlots);
assert(!('instanceId' in decoded.value.ammoSlots![0]) && !('ownedQuantity' in decoded.value.ammoSlots![0]),
  'Public battle quantity does not publish account inventory fields');
writeFileSync('recovery/output/ammo-stock-snapshot.json', JSON.stringify({status: 'PASS',
  unsignedInstance: true, battleCap: true, schemaRoundtrip: true, noAccountFields: true,
  ammoSlots: decoded.value.ammoSlots}, null, 2));
console.log('PASS actual unsigned loadout capped stock and wire roundtrip');
