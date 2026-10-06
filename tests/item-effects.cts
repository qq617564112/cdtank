import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import {roleAmmoUiDefinition} from '../recovery/evidence/combat/role-ammo-change-ui';
import {roleAmmoEffectName} from '../apps/web/src/assets/tanks/role-ammo-visual';
const evidence: {rows: {itemTableId: number; effects: {effectId: number; tag: number; method: number; sound: string}[]}[]} =
  JSON.parse(readFileSync('recovery/output/item-effects-native.json', 'utf8'));
const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
for (const row of evidence.rows) {
  const item = catalog.items.find(item => item.itemTableId === row.itemTableId)!;
  assert(item);
  assert.deepEqual(item.effects!.map(effect => ({...effect, effectId: effect.effectId >>> 0,
    tag: effect.tag >>> 0, method: effect.method >>> 0})), row.effects);
  assert.deepEqual(roleAmmoUiDefinition(item), {name: item.name, field74: row.effects[0].effectId});
}
assert.equal(roleAmmoUiDefinition(undefined), undefined);
assert.equal(roleAmmoUiDefinition({...catalog.items[0], effects: undefined}), undefined);
const ordinary = roleAmmoUiDefinition(catalog.items.find(item => item.itemTableId === 2001))!;
assert.equal(ordinary.name, '普通炮弹');
assert.equal(ordinary.field74, 4);
assert.equal(roleAmmoEffectName(ordinary.field74), '_root\\online\\004');
console.log(`PASS: ${evidence.rows.length} published items/all612 effect slots match original loop; confirmed ordinary ammo resolves online004`);
