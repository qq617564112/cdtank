import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {TankShotPlayerResult} from '../apps/web/src/assets/tanks/shot-player-result';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const victim = {tankId: 3} as TankView;
const remote = {tankId: 1} as TankView;
const calls: unknown[][] = [];
const backend = {
  spawnAttachedEffect: (...args: unknown[]) => {calls.push(['effect', ...args]); return 1;},
  playSkillSound: (...args: unknown[]) => {calls.push(['sound', ...args]); return 1;},
};
const consumer = new TankShotPlayerResult(backend, catalog);
for (const local of [victim, remote, undefined]) {
  calls.length = 0;
  consumer.showPlayerResult(victim, 2015, local);
  assert.deepEqual(calls, [['effect', victim, 24, 0, true, local], ['sound', victim, 'SE19', 1]]);
}
calls.length = 0;
for (const item of [0, 2007, 2023]) consumer.showPlayerResult(victim, item, victim);
assert.deepEqual(calls, [], 'Unknown, retained burn and unconfirmed rocket do not enter this consumer');
const missingTrigger = {...catalog, skills: catalog.skills.map(skill =>
  skill.skillId === 4013 ? {...skill, triggerType: 0} : skill)};
new TankShotPlayerResult(backend, missingTrigger).showPlayerResult(victim, 2015, victim);
assert.deepEqual(calls, [], 'The item must resolve an original Trigger8 skill');
writeFileSync('recovery/output/combat-shot-player-result-2015-consumer.json', JSON.stringify({
  status: 'PASS_SOURCE_MAPPED_CONSUMER_ONLY',
  checks: ['source2015/4013 Trigger8', 'victim024 tag0 oneShot and spatialSE19 selector1 order',
    'local/remote/absent local-view identity forwarded', 'unconfirmed/retained ammo excluded', 'missing Trigger8 silent'],
  ordinaryGameplayTriggered: false,
}, null, 2) + '\n');
console.log('PASS_SOURCE_MAPPED_CONSUMER_ONLY');
