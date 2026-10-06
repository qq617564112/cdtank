import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {getBattlefield} from '../apps/server/src/battlefield';
import {fireProjectile, type BulletState} from '../apps/server/src/battle/projectiles';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type ShotPlayer = Parameters<typeof fireProjectile>[1];
const player: ShotPlayer & {alive: boolean} = {
  id: 'P1', name: 'Owner', x: 1000000, y: 0, z: 1000000, alive: true,
  yaw: 0, aim: 0, tank: {attack: 100},
  combat: {specialFlag12: 0, currentAmmoTableId: 2001},
  armorReady: true,
  recoveredArmor: {attackBase: 100, attackPercent: Math.fround(.732), attackBonus: 78,
    defenseBonus: 0, defensePercent: 0, sideDefensePercent: 0,
    backDefensePercent: 0, selectedSkillIds: [2001, 13001]},
};
const target = {id: 'P2', alive: true, x: player.x, y: 0, z: player.z + 100};
const room = {roomId: 'R1', battlefield: getBattlefield(7), bullets: [] as BulletState[],
  players: new Map([[player.id, player], [target.id, target]])};
const events: MsgRoomEvent[] = [];
let serial = 0;
function shoot(): number {
  let damage = -1;
  fireProjectile(room, player, 1, () => 'B' + ++serial, events, 20, undefined,
    (targetId, value, ammo) => {
      assert.equal(targetId, target.id); assert.equal(ammo, 2001); damage = value;
    });
  assert.equal(events.at(-1)!.type, 'fire');
  return damage;
}
assert.equal(shoot(), 151, 'Accepted ordinary hit consumes qualified attack');
player.recoveredArmor!.attackPercent = Math.fround(player.recoveredArmor!.attackPercent + .2);
assert.equal(shoot(), 171, 'Permanent barrel increase reaches the hit callback');
player.attackBoost = {skillId: 4, expiresAt: 10000, attackPercent: 100, attackBonus: 20};
player.recoveredArmor!.attackPercent = Math.fround(.732 + .2 + 1);
player.recoveredArmor!.attackBonus = 98;
assert.equal(shoot(), 291, 'Drink already recomputed into attack is not applied twice');
player.armorReady = false;
assert.equal(shoot(), 52.6, 'Withdrawn qualification ignores stale recovered attack');
player.attackBoost = undefined;
assert.equal(shoot(), 43, 'Unqualified source uses existing attack input');
player.armorReady = true;
player.recoveredArmor = undefined;
assert.equal(shoot(), 43, 'Qualification without its value cannot supply damage');
player.recoveredArmor = {attackBase: 100, attackPercent: 1.2, attackBonus: 0,
  defenseBonus: 0, defensePercent: 0, sideDefensePercent: 0,
  backDefensePercent: 0, selectedSkillIds: [2002, 13001]};
player.combat.currentAmmoTableId = 2002;
fireProjectile(room, player, 1, () => 'B' + ++serial, events, 20);
assert.equal(room.bullets.at(-1)!.damage, 120);
player.recoveredArmor.attackPercent = 2;
assert.equal(room.bullets.at(-1)!.damage, 120, 'Created projectile retains its attack across later changes');
writeFileSync('recovery/output/qualified-shot-attack-consumer.json', JSON.stringify({
  status: 'PASS_QUALIFIED_ATTACK_PERMANENT_BARREL_DRINK_ONCE_WITHDRAWAL_PROJECTILE_CAPTURE_SCOPE',
  qualifiedBase: 151, barrel: 171, drink: 291, unqualified: 43,
  scope: 'Fixture consumer calls into actual fireProjectile target query and hit callback; no ordinary account acquisition claim.',
}, null, 2) + '\n');
console.log('PASS: qualified attack reaches hits and projectile creation; readiness and drink contribution respected');
