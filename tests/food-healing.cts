import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {calculateFoodHealing} from '../apps/server/src/battle/roles/food-healing';

// Original percentage conversion preserves float32, including the 20% boundary.
const rate = Math.fround(20 * Math.fround(.01));
assert(200 * (1 + rate) < 240);
assert.equal(calculateFoodHealing(200, rate), 240);
assert.equal(calculateFoodHealing(400, rate), 480);
assert.equal(calculateFoodHealing(200), 200);
assert.equal(calculateFoodHealing(400, 0), 400);
const evidence = {status: 'PASS_WEB_FOOD_HEALING_FLOAT32_ROUNDING_SCOPE',
  qualifiedRate: rate, smallFood: 240, largeFood: 480, unqualifiedSmallFood: 200,
  scope: 'Pure amount only; caller supplies role qualification, HP clamp and durable consumption.'};
writeFileSync('recovery/output/food-healing.json', JSON.stringify(evidence, null, 2));
console.log(evidence.status);
