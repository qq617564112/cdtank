import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {classifyItemId} from '../apps/shared/combat/item-hotkeys';

const items = JSON.parse(readFileSync('recovery/output/verified/tables/item.json', 'utf8'));
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const queue = JSON.parse(readFileSync('recovery/output/effects-role-queue-reentry.json', 'utf8'));
const mappings = [17031, 17032].map((itemId, index) => {
  const source = items.rows.find((row: {values: Record<string, string>}) =>
    row.values.ItemTableID === String(itemId)).values;
  const item = catalog.items.find((row: {itemTableId: number}) => row.itemTableId === itemId);
  const skillId = 13501 + index;
  assert.equal(Number(source.ItemSkill1), skillId);
  assert.deepEqual(item.skillIds, [skillId, 0, 0]);
  assert.equal(Number(source.ItemType), 12);
  assert.equal(classifyItemId(itemId), 12);
  assert.equal(item.moneyPrice, Number(source.ItemMoney));
  assert.equal(item.tokenPrice, Number(source.ItemCoin));
  const effect = queue.effects.find((row: {skill: number}) => row.skill === skillId);
  assert(effect);
  return {itemId, name: item.name, itemCategory: 12, equipmentTarget: 'PART', skillId,
    moneyPrice: item.moneyPrice, tokenPrice: item.tokenPrice,
    effectId: effect.effect, root: effect.root, drawingNodes: effect.draws,
    sound: queue.sourceSound};
});
writeFileSync('recovery/output/role-queued-glow-source.json', JSON.stringify({
  status: 'PASS_ITEM_QUEUE_MAPPING_ONLY', mappings,
  resourceNativeModuleReuse: ['effects-role-queue-reentry.json', 'skill-effect-queue-native.json'],
  ordinaryProducerVerified: false,
  scope: 'Original owned part item maps to an existing silent role-queue skill; no authoritative trigger or ordinary pixels asserted.'}, null, 2) + '\n');
console.log('PASS_ITEM_QUEUE_MAPPING_ONLY: original17031/17032 part slots →13501/13502 silent31/32');
