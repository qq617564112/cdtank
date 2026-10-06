import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

const base = JSON.parse(readFileSync('recovery/output/combat-shot-item-result-2004-actual.json', 'utf8'));
assert.equal(base.status, 'PASS_TRANSACTION_AUDIO_CLEANUP_ONLY');
const visualPath = process.argv[2];
assert(visualPath);
const visual = JSON.parse(readFileSync(visualPath, 'utf8'));
assert.equal(visual.status, 'PASS');
assert.equal(visual.ammo, 2004);
assert(visual.purchase.balance.includes('金币：75 · 软星币：0'));
const [local, remote] = visual.observed;
assert.deepEqual(local.results[0].event, remote.results[0].event);
assert.equal(remote.results[0].event.shotItemResult.itemId, 2004);
assert.equal(remote.results[0].event.targetId, 'ENV:79');
assert.equal(local.results[0].feedback, 0);
assert.deepEqual(local.effects, []);
assert.deepEqual(local.sounds, []);
assert.equal(local.gaSounds?.length ?? 0, 0);
assert.equal(remote.results[0].feedback, 1);
assert.equal(remote.effects.length, 1);
const effect = remote.effects[0];
assert.equal(effect.root, 2432);
assert(effect.world && effect.expired);
for (const index of [2433, 2434, 2435, 2447, 2448]) {
  assert(effect.rendered.includes(index));
  assert(effect.vertices[index] > 0);
  assert(effect.textures[index]);
}
assert.equal(remote.resultFrames.length, 3);
const captures = remote.resultFrames.map((frame: {rendered: number[]; frame: number}, index: number) => {
  assert(frame.rendered.length > 0);
  const path = visualPath.replace('.json', `-result-frame-2-${index}.png`);
  assert(readFileSync(path).length > 0);
  return {path, frame: frame.frame, submitted: frame.rendered};
});
for (const counts of visual.cleanup) {
  assert.deepEqual(counts, {instances: 0, meshes: 0, voices: 0, state: 'stopped'});
}
writeFileSync('recovery/output/combat-shot-item-result-2004-composed.json', JSON.stringify({
  status: 'PASS_LIMITED_COMPOSED_PLAYER_SCOPE', tasks: ['M4-09', 'M4-10'],
  transactionAudioCleanup: 'combat-shot-item-result-2004-actual.json',
  visualRaw: visualPath, captures, visibleOutputAccepted: true,
  visualReview: 'Three complete320x180 natural frames show the original007 explosion/fire/light and smoke at the accepted destruction endpoint.',
  worldRoot: effect.root, allDrawingNodesSubmitted: effect.rendered,
  pixelScope: 'Visible combined original effect; individual node pixel separation and HD not established.',
  originalRawStatuses: {purchaseBeforeCatalog: 'FAIL', firstPurchased: 'PARTIAL_CLIPPED', visualSupplement: 'PASS'},
  sourceModuleResourceReuse: base.resourceReuse,
  audio: {planarSE30: base.remote.planarSE30, GA07: base.remote.GA07},
  persistenceReuse: 'ammo04-persistence-accepted.json',
  fixture: visual.fixture, purchase: visual.purchase, cleanup: visual.cleanup,
  missing: ['HD/individual node pixel separation', 'original server destruction/HP/flight policy',
    'ordinary objective result', 'all special ammo scene results'], parentsComplete: false,
}, null, 2) + '\n');
console.log('PASS_LIMITED_COMPOSED_PLAYER_SCOPE: 2004 scene007 visible output plus accepted audio/transaction/Leave');
