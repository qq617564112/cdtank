import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TankShotDisplay} from '../apps/web/src/assets/tanks/shot-display';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const recovered = JSON.parse(readFileSync('recovery/output/combat-shot-loader-native.json', 'utf8')) as {
  contract: {itemId: number; skillId: number; effectName: string; sound: string};
};
const forwarding = JSON.parse(readFileSync('recovery/output/projectile-parameters-sol-native.json', 'utf8')) as {
  rows: Array<{xyzBits: number[]; events: Array<{kind: string; xyzBits?: number[]}>}>;
};
const calls: Array<{kind: string; name: string; origin?: number[]}> = [];
const display = new TankShotDisplay({
  spawnWorldEffect: (name, origin) => {calls.push({kind: 'effect', name, origin}); return 73;},
  playShotSound: name => {calls.push({kind: 'sound', name}); return 91;},
}, catalog);
const contract = recovered.contract;
assert.equal(catalog.items.find(item => item.itemTableId === contract.itemId)?.skillIds[1], contract.skillId);
let count = 0;
for (const row of forwarding.rows.filter(row => row.events.some(event => event.kind === 'worldEffect'))) {
  const bits = new Uint32Array(row.xyzBits);
  const [x, y, z] = new Float32Array(bits.buffer);
  calls.length = 0;
  display.show({itemId: contract.itemId, x, y, z});
  assert.deepEqual(calls, [{kind: 'effect', name: contract.effectName, origin: [x, y, z]},
    {kind: 'sound', name: contract.sound}]);
  count++;
}
console.log(`PASS: original2001 loader selects4020 world007/SE30; ${count} native XYZ forwards reach formal shot consumer unchanged`);
