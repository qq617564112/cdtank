import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createBattlePlayer} from '../apps/server/src/battle/create-player';
import {bindOwnedBattleSources} from '../apps/server/src/battle/preparation';
import {recomputeBattleAttributes} from '../apps/server/src/battle/attributes';
import {TANKS} from '../apps/server/src/config';

const fixture = JSON.parse(readFileSync('recovery/output/pet2-binding-candidate-owned-fields.json', 'utf8'));
const native = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8'));
const tank = TANKS.find(row => row.id === 52)!;
const base = {name: fixture.record.name, fields: new Map<number, number>(fixture.record.fields)};
const equipment = {name: 'Explicit medium-tank attribute fixture', fields: new Map<number, number>(
  Object.entries(native.rows[0].equipment).map(([key, value]) => [Number(key), Number(value)]))};
equipment.fields.set(0x24, 52);
const player = createBattlePlayer('fixture', 'fixture', 'Host', tank, 0,
  {x: 0, y: 0, z: 0, yaw: 0}, {sequence: 0, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: 0});
player.ownedRoles.replace({base, equipment});
recomputeBattleAttributes(player);
const unbound = {movement: {...player.recoveredMovement!}, armor: {...player.recoveredArmor!}};
const slots = Array.from(player.combat.record!.arrays.get(4)!);
bindOwnedBattleSources({phase: 'WAITING', ready: new Set()}, player, {base, equipment});
const bound = {movement: {...player.recoveredMovement!}, armor: {...player.recoveredArmor!}};
assert(bound.armor.selectedSkillIds.includes(10251));
assert(bound.movement.speed > unbound.movement.speed);
assert(bound.movement.turn > unbound.movement.turn);
assert(bound.armor.attackPercent > unbound.armor.attackPercent);
assert(bound.armor.defensePercent > unbound.armor.defensePercent);
assert.deepEqual(Array.from(player.combat.record!.arrays.get(4)!), slots);
writeFileSync('recovery/output/selected-bound-attributes.json', JSON.stringify({
  status: 'PASS_SELECTED_BOUND_UNIFIED_MOVEMENT_ARMOR_CONSUMERS',
  scope: 'Explicit medium-tank attribute fixture; table ID52 supplied before preparation, no acquisition or network claim.',
  unbound, bound, currentSkillIds: slots,
}, null, 2) + '\n');
console.log('PASS: shared selected source reaches movement and armor without changing current slots');
