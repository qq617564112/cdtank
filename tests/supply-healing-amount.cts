import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {calculateSupplyHealingAmount} from '../apps/server/src/battle/roles/supply-healing-amount';

const cases = [
  {hp: 602, maxHp: 700, base: 20, expected: 20},
  {hp: 622, maxHp: 700, base: 20, expected: 20},
  {hp: 695, maxHp: 700, base: 20, expected: 5},
  {hp: 700, maxHp: 700, base: 20, expected: 0},
  {hp: 701, maxHp: 700, base: 20, expected: 0},
  {hp: 602, maxHp: 700, base: 0, expected: 0},
];
for (const row of cases) {
  assert.equal(calculateSupplyHealingAmount(row.hp, row.maxHp, row.base), row.expected);
}
const result = {status: 'PASS_FINITE_SUPPLY_HEALING_BASE20_MAX_HP_CLAMP_AMOUNT_SCOPE', cases,
  policy: 'Web amount only; authority owns equipped-source qualification, alive gate and 3000ms clock'};
writeFileSync('recovery/output/supply-healing-amount.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
