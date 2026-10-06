import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {combatSkills} from '../apps/server/src/battle/catalog';
import {startAmmoSlow, advanceAmmoSlow, clearAmmoSlow,
  type AmmoSlowParticipant} from '../apps/server/src/battle/items/ammo-slow';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const source = combatSkills.get(4006)!;
assert.equal(source.triggerType, 8); assert.equal(source.functions[0].type, 1);
assert.equal(source.functions[0].t, 15); assert.equal(source.attributes.ItemMove, -6);
const slots = new Int32Array(16); slots[0] = 6;
const target: AmmoSlowParticipant = {id: 'P2', alive: true, x: 10, y: 0, z: 30,
  attributesReady: true, combat: new RoleCombatState({status: 2, flags: new Uint8Array(16),
    arrays: new Map([[4, slots]])})};
const events: MsgRoomEvent[] = []; let recomputes = 0;
const recompute = () => {recomputes++;};
assert(startAmmoSlow('R1', target, 1000, recompute, events));
assert.equal(target.ammoSlow!.expiresAt, 16000); assert(slots.includes(4006));
assert(slots.includes(6)); assert.equal(recomputes, 1);
assert(!startAmmoSlow('R1', target, 2000, recompute, events));
assert.equal(target.ammoSlow!.expiresAt, 16000);
advanceAmmoSlow('R1', target, 15999, recompute, events); assert(target.ammoSlow);
advanceAmmoSlow('R1', target, 16000, recompute, events);
assert.equal(target.ammoSlow, undefined); assert(!slots.includes(4006)); assert(slots.includes(6));
assert.equal(recomputes, 2); assert.equal(events.at(-1)!.type, 'ammoSlowEnded');
assert(startAmmoSlow('R1', target, 17000, recompute, events));
target.alive = false; advanceAmmoSlow('R1', target, 17001, recompute, events);
assert.equal(target.ammoSlow, undefined); assert(!slots.includes(4006));
assert(!startAmmoSlow('R1', target, 18000, recompute, events));
target.alive = true; target.attributesReady = false;
assert(!startAmmoSlow('R1', target, 18000, recompute, events));
assert.equal(events.at(-1)!.type, 'ammoSlowRejected');
target.attributesReady = true; slots.fill(6);
assert(!startAmmoSlow('R1', target, 18000, recompute, events)); assert(slots.every(id => id === 6));
slots.fill(0); slots[0] = 6;
assert(startAmmoSlow('R1', target, 19000, recompute, events));
clearAmmoSlow(target, recompute); assert(slots.includes(6)); assert(!slots.includes(4006));
writeFileSync('recovery/output/ammo-slow.json', JSON.stringify({status: 'PASS_STATE_MODULE_SCOPE',
  originalSkill: 4006, durationSeconds: 15, moveAttribute: -6, noRefreshOrStack: true,
  naturalExpiry: true, deadAndUnavailableStateRejected: true, unrelatedSpeedSkillPreserved: true,
  scope: 'Temporary skill ownership, original field use and lifecycle; movement arithmetic and ordinary network verified separately.'}, null, 2)+'\n');
console.log('PASS: source4006 fifteen-second skill ownership, expiry/death/qualification');
