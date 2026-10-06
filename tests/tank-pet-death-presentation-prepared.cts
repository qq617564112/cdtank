import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {TankPetDeathPresentation} from '../recovery/prepared/tank-pet-death-presentation/apps/web/src/assets/tanks/tank-pet-death-presentation';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';

const target = {} as TankView;
const local = {} as TankView;
const calls: unknown[][] = [];
const presentation = new TankPetDeathPresentation({spawnAttachedEffect(...args) {
  calls.push(args);
  return calls.length;
}});
assert.equal(presentation.show(target, 1, local), 1);
assert.equal(presentation.show(target, 2, target), 2);
assert.equal(presentation.show(target, 3, local), 0);
assert.deepEqual(calls, [[target, 119, 0, true, local], [target, 120, 0, true, target]]);
writeFileSync('recovery/output/tank-pet-death-presentation-prepared.json', JSON.stringify({
  status: 'PASS_PREPARED_PET_DEATH_DISPATCH_ONLY',
  cases: ['PetType1→119/tag0/oneShot1', 'PetType2→120/tag0/oneShot1', 'OtherType→no effect'],
  scope: 'Only the prepared numeric dispatch and exact target/local references. Original death source, '
    + 'runtime lifecycle and resource contracts are reused; no formal death integration, original '
    + 'table adapter, browser draw/audio or ordinary gameplay claim.',
}, null, 2) + '\n');
console.log('PASS_PREPARED_PET_DEATH_DISPATCH_ONLY');
