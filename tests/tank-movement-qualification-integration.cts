import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {originalMovementParameters} from '../apps/server/src/battle/movement';

const evidence = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8'));
const row = evidence.rows.find((value: {tankId: number; part: number}) => value.tankId === 1 && value.part === 0);
const fields = (values: Record<string, number>) => new Map(Object.entries(values).map(([key, value]) => [Number(key), value]));
const world = new World();
const host = world.createAndJoin('movement-qualification-rule', 4, 7, 'Movement', 'Owner', 1);
const player = world['rooms'].get(host.roomId)!.players.get(host.playerId)!;
const full = {base: {name: 'Explicit source fixture', fields: fields(row.base)},
  equipment: {name: 'Explicit source fixture', fields: fields(row.equipment)}};
world.bindRoleSources(host.playerId, full);
const expected = originalMovementParameters(player);
assert(expected);
const sparse = {base: {name: full.base.name, fields: new Map(full.base.fields)},
  equipment: {name: full.equipment.name, fields: new Map(full.equipment.fields)}};
for (const offset of [0x2c, 0x34, 0x3c]) sparse.base.fields.delete(offset);
for (const offset of [0x3c, 0x40, 0x4c, 0x50]) sparse.equipment.fields.delete(offset);
world.bindRoleSources(host.playerId, sparse);
assert.equal(player.attributesReady, false);
assert.deepEqual(originalMovementParameters(player), expected, 'Missing HP/armor must not block confirmed movement');
assert.equal(player.magazineReady, true);
const missing34 = {base: sparse.base, equipment: {name: sparse.equipment.name, fields: new Map(sparse.equipment.fields)}};
missing34.equipment.fields.delete(0x34);
world.bindRoleSources(host.playerId, missing34);
assert.equal(originalMovementParameters(player), undefined, 'Absent owned+34 must not become zero');
world.bindRoleSources(host.playerId, {base: undefined, equipment: undefined});
assert.equal(originalMovementParameters(player), undefined, 'Withdrawal clears movement eligibility');
const mismatch = {base: sparse.base, equipment: {name: sparse.equipment.name, fields: new Map(sparse.equipment.fields)}};
mismatch.equipment.fields.set(0x24, 3);
world.bindRoleSources(host.playerId, mismatch);
assert.equal(originalMovementParameters(player), undefined, 'Owned tank must match actual battle tank');
const fullMismatch = {base: full.base, equipment: {name: full.equipment.name, fields: new Map(full.equipment.fields)}};
fullMismatch.equipment.fields.set(0x24, 3);
world.bindRoleSources(host.playerId, fullMismatch);
assert.equal(player.attributesReady, false);
assert.equal(originalMovementParameters(player), undefined, 'Complete mismatched ownership must not enable fallback movement');
world.leave(host.playerId);
writeFileSync('recovery/output/tank-movement-qualification-integration.json', JSON.stringify({
  status: 'PASS_RULE_SCOPE_ONLY', expected,
  scope: 'Explicit pre-match sparse source fixture, official attribute qualification; no purchase or network gameplay claim.',
  checks: ['independent movement without HP/armor', 'ammo remains qualified', 'missing +34 rejection', 'source withdrawal', 'tank mismatch rejection']
}, null, 2) + '\n');
console.log('PASS: independent movement qualification and source withdrawal/mismatch');
