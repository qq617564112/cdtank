import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roleHurtSelector} from '../apps/server/src/battle/roles/hurt-direction';
const source = JSON.parse(readFileSync('recovery/output/combat-hit-native.json', 'utf8')) as {
  status: string; classifications: {target: number[]; incoming: number[]; selector: number}[];
};
assert.equal(source.status, 'PASS');
for (const row of source.classifications) {
  const look = (v: number[]) => ({x: v[0], y: v[1], z: v[2]});
  assert.equal(roleHurtSelector(look(row.target), look(row.incoming)), row.selector, JSON.stringify(row));
}
assert.equal(roleHurtSelector({x: 1, y: 0, z: 0}, {x: 1.0000001, y: 0, z: 0}), 2);
assert.equal(roleHurtSelector({x: 1, y: 0, z: 0}, {x: -1.0000001, y: 0, z: 0}), undefined,
  'unrecovered original CRT domain error cannot fabricate an action');
console.log(`PASS ${source.classifications.length} original hurt direction classifications and explicit CRT boundary`);
