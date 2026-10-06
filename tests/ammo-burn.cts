import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {startAmmoBurn, advanceAmmoBurn, clearAmmoBurn} from '../apps/server/src/battle/items/ammo-burn';
import type {AmmoBurnParticipant} from '../apps/server/src/battle/items/ammo-burn';

const participant = (): AmmoBurnParticipant => ({id: 'target', alive: true});
const target = participant();
const damage: Array<{owner: string; amount: number; at: number}> = [];
let now = 1000;
assert(startAmmoBurn(target, 'owner', now));
const state = target.burn!;
assert(!startAmmoBurn(target, 'other', 2500));
assert.equal(target.burn, state);
assert.deepEqual(state, {ownerId: 'owner', startedAt: 1000, nextTick: 1});
const advance = (time: number) => {
  now = time;
  advanceAmmoBurn(target, now, owner => owner === 'owner',
    (owner, amount) => damage.push({owner, amount, at: now}));
};
for (const time of [1000, 3999]) advance(time);
assert.deepEqual(damage, []);
advance(4000);
advance(4000);
assert.equal(damage.length, 1);
assert.equal(state.nextTick, 2);
advance(6999);
assert.equal(damage.length, 1);
advance(7000);
assert.equal(damage.length, 2);
advance(9999);
assert.equal(damage.length, 2);
advance(10000);
assert.equal(target.burn, undefined);
advance(20000);
assert.deepEqual(damage, [4000, 7000, 10000].map(at => ({owner: 'owner', amount: 70, at})));

const delayed = participant();
startAmmoBurn(delayed, 'owner', 1000);
const catchup: number[] = [];
advanceAmmoBurn(delayed, 11000, () => true, (_owner, amount) => catchup.push(amount));
assert.deepEqual(catchup, [70, 70, 70]);
assert.equal(delayed.burn, undefined);

for (const condition of ['dead', 'ownerMissing'] as const) {
  const value = participant();
  startAmmoBurn(value, 'owner', 0);
  if (condition === 'dead') value.alive = false;
  advanceAmmoBurn(value, 9000, () => condition !== 'ownerMissing', () => assert.fail('Invalid burn cannot deal damage'));
  assert.equal(value.burn, undefined);
}
const dead = {...participant(), alive: false};
assert(!startAmmoBurn(dead, 'owner', 0));
assert.equal(dead.burn, undefined);
for (const callback of ['death', 'clear', 'replace', 'ownerLeaves'] as const) {
  const value = participant();
  startAmmoBurn(value, 'owner', 0);
  let ownerPresent = true, calls = 0;
  advanceAmmoBurn(value, 9000, () => ownerPresent, () => {
    calls++;
    if (callback === 'death') value.alive = false;
    if (callback === 'clear') clearAmmoBurn(value);
    if (callback === 'replace') {
      clearAmmoBurn(value);
      startAmmoBurn(value, 'new-owner', 9000);
    }
    if (callback === 'ownerLeaves') ownerPresent = false;
  });
  assert.equal(calls, 1, 'Catchup must stop when damage changes burn eligibility');
  if (callback === 'replace') assert.deepEqual(value.burn, {ownerId: 'new-owner', startedAt: 9000, nextTick: 1});
  else assert.equal(value.burn, undefined);
}
const cleared = participant();
startAmmoBurn(cleared, 'owner', 0);
clearAmmoBurn(cleared);
advanceAmmoBurn(cleared, 9000, () => true, () => assert.fail('Cleared life cannot tick'));
assert(startAmmoBurn(cleared, 'owner', 10000));
assert.equal(cleared.burn!.startedAt, 10000);
writeFileSync('recovery/output/ammo-burn.json', JSON.stringify({status: 'PASS',
  policy: 'Rebuilt4005 fixed70 damage callbacks at3000/6000/9000ms; no refresh/stack, authority callback owns HP/defense.',
  damage, catchup, cases: ['exact deadlines/no duplicate', 'active no refresh', 'large dt',
    'dead/owner missing', 'damage callback death/clear/replace/owner leave', 'clear/reentry']}, null, 2) + '\n');
console.log('PASS: burn3/6/9s, no refresh, catchup and damage/lifecycle callback boundaries');
