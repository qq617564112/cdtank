import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {TSBuffer} from 'tsbuffer';
import {getBattlefield} from '../apps/server/src/battlefield';
import {fireProjectile} from '../apps/server/src/battle/projectiles';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';

const field = getBattlefield(7);
const run = (itemId: number, damageAccepted: boolean, yaw = -1.200480234) => {
  const player = {...field.spawns[0], id: 'P1', name: 'Player', alive: true,
    yaw, aim: 0, tank: {attack: 100}, combat: {specialFlag12: 0, currentAmmoTableId: itemId}};
  const events: MsgRoomEvent[] = [];
  const room = {roomId: 'static-box', battlefield: field, bullets: [],
    players: new Map([[player.id, player]])};
  fireProjectile(room, player, 1, () => 'B1', events, 28, () => damageAccepted);
  return events;
};
const events = run(2001, false);
const hit = events.find(event => event.type === 'sceneStaticHit');
assert(hit?.shotItemResult);
assert.equal(hit.targetId, '29');
assert.equal(hit.shotItemResult.itemId, 2001);
assert.deepEqual(hit.shotItemResult, {itemId: 2001, x: hit.x, y: hit.y, z: hit.z});
assert.deepEqual(hit.shotItemResult, events[0].shotDisplay);
assert(!events.some(event => event.type === 'terrainHit' || event.castleDamage || event.sceneCrush));
assert(!run(2001, true).some(event => event.shotItemResult), 'A damage transaction owns its result');
assert(!run(2002, false).some(event => event.type === 'sceneStaticHit'), 'Special ammo retains its projectile path');
const codec = new TSBuffer(serviceProto.types);
const encoded = codec.encode(hit, 'MsgRoomEvent/MsgRoomEvent');
assert(encoded.isSucc, JSON.stringify(encoded));
const decoded = codec.decode<MsgRoomEvent>(encoded.buf, 'MsgRoomEvent/MsgRoomEvent');
assert(decoded.isSucc, JSON.stringify(decoded));
assert.deepEqual(decoded.value, hit);
writeFileSync('recovery/output/scene-static-hit-authority-rules.json', JSON.stringify({
  status: 'PASS_MODULE_AND_WIRE_ONLY', events,
  scope: 'Source map7 BOX29 query, frozen ordinary2001 endpoint, damage-transaction exclusion, special-ammo exclusion, actual wire roundtrip.'
}, null, 2) + '\n');
console.log('PASS_MODULE_AND_WIRE_ONLY: static BOX2001 result authority');
