import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {TSBuffer} from 'tsbuffer';
import {World} from '../apps/server/src/world';
import {createBattlePlayer} from '../apps/server/src/battle/create-player';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {TANKS} from '../apps/server/src/config';
import {respawnPlayer} from '../apps/server/src/battle/life';
import {initializeBattleParticipants} from '../apps/server/src/battle/start';
import {confirmAcceptedAmmoSelection} from '../apps/server/src/battle/items/ammo-confirmation';
import {combatItems} from '../apps/server/src/battle/catalog';
import {playerSnapshot} from '../apps/server/src/rooms/snapshot';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';
import type {MsgPlayerInput, PlayerSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

const input: MsgPlayerInput = {sequence: 0, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: 0};
const records: InventoryWireRecord[] = [
  {instanceId: 77, itemTableId: 2007, ownedQuantity: 2, battleQuantity: 2, state: 0,
    field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0},
  {instanceId: 78, itemTableId: 2002, ownedQuantity: 0, battleQuantity: 0, state: 0,
    field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0},
];
let now = 100000;
const world = new World(() => now, {timeLimitSeconds: 2});
const joined = world.createAndJoin('muzzle-2007', 4, 7, 'Ammo2007', 'Player', 1);
world.bindInventory(joined.playerId, {records, hotkeys: [77, 78, 0, 0, 0, 0, 0]});
let sequence = 0;
const key = (slot: number, seq = ++sequence, fire = false) => world.updateInput(joined.playerId,
  {...input, sequence: seq, useItem: slot, fire, clientTime: now});
const snapshot = () => world.snapshot(joined.roomId)!.players.find(player => player.id === joined.playerId)!;
assert.equal(snapshot().ammoItemId, 2001);
key(2);
assert.equal(snapshot().ammoItemId, 2001, 'Waiting input cannot confirm ammo');
world.ready(joined.playerId, 1);
assert.equal(snapshot().ammoItemId, 2001, 'First start resets confirmation');
const inventory = world.inventory(joined.playerId);
key(2);
assert.equal(snapshot().ammoItemId, 2007);
assert.equal(snapshot().selectedAmmoSlot, 2);
for (const slot of [3, 4, 9]) {
  key(slot);
  assert.equal(snapshot().ammoItemId, 2007, 'Empty/missing/invalid slot cannot change confirmation');
}
key(1, sequence);
assert.equal(snapshot().ammoItemId, 2007, 'Stale default selection cannot change confirmation');
const codec = new TSBuffer(serviceProto.types);
const encoded = codec.encode(snapshot(), 'MsgRoomSnapshot/PlayerSnapshot');
assert(encoded.isSucc);
const decoded = codec.decode<PlayerSnapshot>(encoded.buf, 'MsgRoomSnapshot/PlayerSnapshot');
assert(decoded.isSucc);
assert.equal(decoded.value.ammoItemId, 2007);
const fires: MsgRoomEvent[] = [];
key(0, ++sequence, true);
now += 50;
fires.push(...world.step(50).events.filter(event => event.type === 'fire'));
assert.equal(fires.length, 1);
assert.equal(fires[0].skillId, 2007);
assert(fires[0].shotDisplay, 'Single player ordinary free/scene shot publishes display');
assert.equal(fires[0].shotDisplay.itemId, 2007);
const eventWire = codec.encode(fires[0], 'MsgRoomEvent/MsgRoomEvent');
assert(eventWire.isSucc);
const eventDecoded = codec.decode<MsgRoomEvent>(eventWire.buf, 'MsgRoomEvent/MsgRoomEvent');
assert(eventDecoded.isSucc);
assert.equal(eventDecoded.value.shotDisplay!.itemId, 2007);
assert.equal(world.inventory(joined.playerId).records[0].ownedQuantity, inventory.records[0].ownedQuantity - 1);
assert.equal(world.inventory(joined.playerId).records[0].battleQuantity, inventory.records[0].battleQuantity - 1);
key(1);
assert.equal(snapshot().ammoItemId, 2001);
key(2);
assert.equal(snapshot().ammoItemId, 2007);
now += 2000;
world.step(2000);
assert.equal(world.snapshot(joined.roomId)!.phase, 'FINISHED');
key(1);
assert.equal(snapshot().ammoItemId, 2007, 'Finished input cannot change confirmation');
world.rematch(joined.playerId, 1);
assert.equal(snapshot().ammoItemId, 2001, 'Consensus rematch cannot retain2007');
assert.equal(snapshot().selectedAmmoSlot, 1);
key(0, ++sequence, true);
now += 50;
const defaultFire = world.step(50).events.find(event => event.type === 'fire')!;
assert(defaultFire);
assert.equal(defaultFire.skillId, 2001);
assert.equal(defaultFire.shotDisplay!.itemId, 2001);
world.leave(joined.playerId);

// Explicit lifecycle module fixture verifies actual respawn/round entry calls.
const field = createRoomBattlefield(7);
const player = createBattlePlayer('life', 'life-client', 'Life', TANKS[0], 0, field.spawn(0), input);
player.inventory = records.map(record => ({...record}));
player.combat.record!.arrays.get(0)![0] = 77;
player.combat.setStatus(2);
assert(confirmAcceptedAmmoSelection(player.combat, player.inventory, 2));
player.alive = false;
player.combat.setStatus(3);
respawnPlayer(field, player, 300, input);
assert.equal(player.combat.currentAmmoTableId, 2001);
assert.equal(playerSnapshot(player, 300).ammoItemId, 2001);
assert.equal(player.combat.selectedAmmoSlot, 1);
assert(confirmAcceptedAmmoSelection(player.combat, player.inventory, 2));
initializeBattleParticipants(field, [player], input, () => {}, () => 300, () => now);
assert.equal(playerSnapshot(player, 300).ammoItemId, 2001);
assert.equal(player.combat.selectedAmmoSlot, 1);
const item = combatItems.get(2007)!;
assert(item.effects);
assert.equal(item.effects[0].effectId, 54);
assert.equal(item.effects[0].sound, 'GA09');
assert.equal(item.effects[1].effectId, 0);
assert.equal(item.effects[1].sound, '0');
writeFileSync('recovery/output/combat-muzzle-2007-glue.json', JSON.stringify({status: 'PASS',
  policy: 'Rebuilt server confirms actual inventory tableID after original input gates;2007 accepted fire consumes one under the finite policy. No new projectile/damage rules.',
  tests: ['default/first-start', 'normal2007 selection', 'empty/missing/invalid/stale/waiting/finished rejection',
    'snapshot/event actual schema roundtrip', 'ordinary accepted2007 fire/finite consumption',
    'default switch', 'consensus rematch default', 'explicit real respawn/round reset modules'],
  fire: fires[0], defaultFire, itemEffects: item.effects}, null, 2) + '\n');
console.log('PASS: ordinary2007 confirmation/fire/wire/rejections, finite consumption, default/respawn/rematch reset');
