import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
const [firstPath, leavePath] = process.argv.slice(2);
const first = JSON.parse(readFileSync(firstPath, 'utf8'));
const leave = JSON.parse(readFileSync(leavePath, 'utf8'));
assert.equal(first.status, 'FAIL');
assert(first.error.includes('2001 !== 2011'));
assert.equal(leave.status, 'PASS'); assert.equal(leave.leaveOnly, true);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
assert(first.sameRenderedHit.length > 0);
for (const event of first.sameRenderedHit) {
  assert.equal(event.type, 'hit'); assert.equal(event.shotPlayerResult.itemId, 2011);
  for (const side of first.observed) {
    const effect = side.effects.find((e: any) => same(e.result.event, event) && e.expired);
    assert(effect && effect.liveParent);
    assert.deepEqual(effect.nodes, [2693, 2694]); assert.deepEqual(effect.rendered, [2693, 2694]);
    assert(Object.values(effect.vertices).every(v => Number(v) > 0));
    assert(String(effect.textures[2693]).endsWith('/Data/effect/xy/helloA.png'));
    assert(String(effect.textures[2694]).endsWith('/Data/effect/effect/xingxing_BAI.png'));
    const sound = side.sounds.find((s: any) => same(s.result.event, event) && s.played && s.ended && s.outputPeak > 0);
    assert(sound); assert.equal(sound.reference, 'SE25'); assert.equal(sound.selector, 1); assert.equal(sound.loop, false);
    assert.deepEqual(sound.position, sound.result.position);
  }
}
assert(leave.sameHit.length > 0);
for (const side of leave.observed) assert(side.effects.length > 0);
for (const row of leave.cleanup) assert.deepEqual(row, {instances: 0, meshes: 0, voices: 0, skillVoices: 0, state: 'stopped'});
writeFileSync('recovery/output/combat-shot-player-result-2011-actual.json', JSON.stringify({status: 'PASS_LIMITED_PLAYER_SCOPE',
  tasklist: ['M4-09', 'M4-10'], actual: firstPath, cleanup: leavePath,
  originalFailurePreserved: true, sameRenderedHits: first.sameRenderedHit,
  checks: ['same formal2011 hit on both pages', 'original020 two nodes/live victim parent/textures/natural end',
    'spatialSE25 actual wave/ended', 'second ordinary hit then Leave all resources zero'],
  limits: ['original server damage/flight/result permissions remain reconstructed', 'pre-room inventory fixture disclosed',
    'complete ammo content, all scenes and HD not accepted', 'Rematch/death branches reuse2001 shared baseline, no2011-specific revalidation']}, null, 2) + '\n');
console.log('PASS limited2011 original victim020/spatialSE25 and ordinary Leave composition');
