import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import type {GroundTrapSnapshot} from '../apps/shared/protocols';
import {selectSweepTraps} from '../apps/server/src/battle/items/trap-sweep';

const jar = (id: string, x: number, z: number, expiresAt = 2000): GroundTrapSnapshot => ({
  id, ownerId: 'P2', team: 1, itemTableId: 3005, modelId: 3005, x, y: 900, z, expiresAt});
const traps = [jar('cork', 0, 0), jar('boundary', 240, 320), jar('outside', 240, 320.01),
  jar('expired', 0, 0, 1000)];
const source = JSON.stringify(traps);
const picked = selectSweepTraps(traps, {x: 0, z: 0}, 1000, 400);
assert.deepEqual(picked, [traps[0], traps[1]]);
assert.equal(picked[0], traps[0]); assert.equal(picked[1], traps[1]);
assert.equal(JSON.stringify(traps), source);
writeFileSync('recovery/output/trap-sweep-cork-rules.json', JSON.stringify({
  status: 'PASS_NEW3005_SELECTOR_ONLY', selectedIds: picked.map(row => row.id),
  scope: 'Only new3005 support, inclusive400 boundary/outside/expired/Yignored/identity/no mutation. Old3003 selector suite reused.'}, null, 2) + '\n');
console.log('PASS: new3005 sweep support and boundary/expiry/reference contract');
