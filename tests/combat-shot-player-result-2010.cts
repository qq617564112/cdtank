import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {TankShotPlayerResult} from '../apps/web/src/assets/tanks/shot-player-result';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const victim = {tankId: 1} as TankView;
const local = {tankId: 105} as TankView;
const calls: unknown[][] = [];
const consumer = new TankShotPlayerResult({
  spawnAttachedEffect: (...args) => {calls.push(['effect', ...args]); return 1;},
  playSkillSound: (...args) => {calls.push(['sound', ...args]); return 1;},
}, catalog);
for (const localView of [local, victim]) {
  consumer.showPlayerResult(victim, 2010, localView);
  assert.deepEqual(calls, [['effect', victim, 13, 0, true, localView], ['sound', victim, 'SE14', 1]]);
  calls.length = 0;
}
for (const item of [0, 2021, 2020, 2007]) consumer.showPlayerResult(victim, item, local);
assert.deepEqual(calls, []);
writeFileSync('recovery/output/combat-shot-player-result-2010.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', source: 'original2010/4008 Trigger8; existing424614/4886aa dispatch',
  checks: ['original013/tag0/oneShottrue', 'spatialSE14 selector1', 'local-view forwarding',
    'unrestored ammo does not start generic effects'],
  ordinaryGameplayTriggered: false, actualPixelsOrAudioOutputVerified: false,
}, null, 2) + '\n');
console.log('PASS_MODULE_ONLY original2010/4008 victim013/SE14');
