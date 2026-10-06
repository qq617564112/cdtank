import assert from 'node:assert/strict';
import {TANKS} from '../apps/server/src/config';

assert.equal(TANKS.length, 21, 'the source tank table must expose all 21 rows');
for (const tank of TANKS) {
  assert.equal(tank.reload, tank.recomputeBase.reloadDuration,
    `legacy reload projection must use TankDelay for tank ${tank.id}`);
}
assert(new Set(TANKS.map(tank => tank.reload)).size > 1,
  'the source table must not collapse all tanks to one prototype duration');
console.log(`PASS: ${TANKS.length} tank reload projections use source TankDelay values`);
