import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createBattlePlayer} from '../apps/server/src/battle/create-player';
import {recomputeBattleAttributes} from '../apps/server/src/battle/attributes';
import {TANKS} from '../apps/server/src/config';

const capturePath = 'recovery/output/tank-purchased-movement-network-2026-10-04T16-14-09-828Z.json';
const capture = JSON.parse(readFileSync(capturePath, 'utf8')) as {
  status: string;
  expected: {speed: number; turn: number};
  purchases: {tank: {purchased: {name: string; fields: [number, number][]}};
    pet: {purchased: {name: string; fields: [number, number][]}}};
};
assert.equal(capture.status, 'PASS_PURCHASED_TANK3_PET2_VIP_MOVEMENT');
const rows = [];
for (const vip of [false, true]) {
  for (const absent of ['hp', 'armor', 'both', 'field34', 'pet', 'itemSource'] as const) {
    const player = createBattlePlayer('rule-only', '', 'rule-only', TANKS.find(tank => tank.id === 3)!,
      0, {x: 0, y: 0, z: 0, yaw: 0}, {sequence: 0, move: 0, turn: 0, aim: 0,
        fire: false, useItem: 0, clientTime: 0});
    const base = {name: capture.purchases.pet.purchased.name,
      fields: new Map(capture.purchases.pet.purchased.fields)};
    const equipment = {name: capture.purchases.tank.purchased.name,
      fields: new Map(capture.purchases.tank.purchased.fields)};
    // Local qualification cases derived from actual purchases; never written to
    // an account or sent to an active room, and never claimed as a player path.
    if (absent === 'hp' || absent === 'both') {
      for (const offset of [0x2c, 0x34, 0x3c]) base.fields.delete(offset);
    }
    if (absent === 'armor' || absent === 'both') {
      for (const offset of [0x3c, 0x40, 0x4c, 0x50]) equipment.fields.delete(offset);
    }
    if (absent === 'field34') equipment.fields.delete(0x34);
    if (absent === 'itemSource') equipment.fields.delete(0x58);
    player.ownedRoles.replace({base: absent === 'pet' ? undefined : base, equipment});
    player.vip = vip;
    const hpBefore = player.hp;
    recomputeBattleAttributes(player);
    assert.equal(player.attributesReady, false);
    assert.equal(player.hp, hpBefore);
    // An owned equipment record must carry all three item-source fields before
    // ammo can be published; sparse HP/armor must remain independent.
    assert.equal(player.magazineReady, absent !== 'itemSource');
    if (absent === 'hp' || absent === 'armor' || absent === 'both') {
      assert.deepEqual(player.recoveredMovement, capture.expected);
    } else {assert.equal(player.recoveredMovement, undefined);}
    rows.push({vip, absent, attributesReady: player.attributesReady, magazineReady: player.magazineReady,
      movement: player.recoveredMovement, hpUnchanged: player.hp === hpBefore});
  }
}
writeFileSync('recovery/output/tank-movement-sparse-qualification.json', JSON.stringify({status: 'PASS',
  sourcePurchases: capturePath, rows,
  scope: 'Local sparse-source qualification only; normal/VIP missing life/armor preserve movement; missing+34/pet/item source refuse. No sparse account or multiplayer path claim.'}, null, 2));
console.log('PASS:12 local sparse-source normal/VIP qualification cases; unrelated HP/armor do not block movement, required source omissions refuse without changing HP');
