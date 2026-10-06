import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {AmmoBurnPresentation} from '../apps/web/src/assets/tanks/ammo-burn-presentation';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
const calls: unknown[][] = [];
let loaded = false, next = 1;
const view = {root: {isDisposed: () => false}} as unknown as TankView;
const presentation = new AmmoBurnPresentation({
  spawnAttachedEffect: (...args) => {calls.push(['start', ...args]); return loaded ? next++ : 0;},
  playSkillSound: (...args) => {calls.push(['sound', ...args]); return next++;},
  stopEffect: id => {calls.push(['stop', id]);}, stopSkillSound: id => {calls.push(['stopSound', id]);},
}, () => loaded ? view : undefined);
const players = [{id: 'P2', alive: true, ammoBurn: {itemId: 2007 as const, skillId: 4005 as const, startedAt: 100, expiresAt: 9100}}];
presentation.reconcile(players, 'R1:1', true); assert.deepEqual(calls, []);
loaded = true; presentation.reconcile(players, 'R1:1', true);
assert.deepEqual(calls, [['start', view, 14, 0, false], ['sound', view, 'SE03', -1]]);
presentation.reconcile(players, 'R1:1', true); assert.equal(calls.length, 2);
players[0].ammoBurn.expiresAt = 10000;
presentation.reconcile(players, 'R1:1', true); assert.equal(calls.length, 2, 'same burn does not refresh/restart');
presentation.reconcile([{id: 'P2', alive: true}], 'R1:1', true);
assert.deepEqual(calls.slice(-2), [['stop', 1], ['stopSound', 2]]);
for (const endpoint of ['death', 'finished', 'round', 'leave']) {
  presentation.reconcile(players, 'R1:1', true);
  const before = calls.length;
  if (endpoint === 'death') presentation.reconcile([{...players[0], alive: false}], 'R1:1', true);
  if (endpoint === 'finished') presentation.reconcile(players, 'R1:1', false);
  if (endpoint === 'round') presentation.reconcile([], 'R1:2', true);
  if (endpoint === 'leave') presentation.clear();
  assert.equal(calls.length, before + 2);
  assert.equal(calls.at(-2)?.[0], 'stop'); assert.equal(calls.at(-1)?.[0], 'stopSound');
}
writeFileSync('recovery/output/ammo-burn-presentation.json', JSON.stringify({status: 'PASS_MODULE_ONLY',
  policy: 'Explicit mainline authority snapshot presence/epoch; no effect or server duration inferred',
  source: 'skill-effect-message.md original4005 retained slot0/tuple/stop',
  checks: ['late role', '014/tag0/oneShotfalse', 'SE03 selector-1', 'duplicate/no refresh',
    'snapshot absence/death/finished/round/clear stop'], ordinaryTriggered: false, actualVisibleAudible: false}, null, 2) + '\n');
console.log('PASS_MODULE_ONLY retained4005 snapshot consumer, duplicate and all stop boundaries');
