import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

const raw = process.argv[2];
const run = JSON.parse(readFileSync(raw, 'utf8'));
assert.equal(run.status, 'INCOMPLETE');
assert.deepEqual(run.failures, [
  'side0 source327 authoritative hidden/root correspondence missing',
  'side1 source327 authoritative hidden/root correspondence missing',
]);
assert(run.initial.every(world => world.mapId === 2 && world.mode === 1 && world.match.scenePlants.length === 29));
assert.deepEqual(run.acceptedTransactions[0], run.acceptedTransactions[1]);
assert.equal(run.acceptedTransactions[0].length, 1);
const event = run.acceptedTransactions[0][0];
assert.equal(event.type, 'scenePlantHidden');
assert.equal(event.targetId, 'PLANT:327');
assert.equal(event.scenePlant.placementId, '327');
assert.equal(event.value, 0);
assert.deepEqual([event.x, event.y, event.z], run.target.matrix.slice(12, 15));
const hiddenHost = run.hiddenWorld.players.find(player => player.id === event.playerId);
const priorInput = run.inputs.at(-1);
assert(run.hiddenWorld.tick > priorInput.tick);
assert(Math.hypot(hiddenHost.x - priorInput.x, hiddenHost.z - priorInput.z) > 0);
const sides = run.observed.map((observed, index) => {
  const initial = run.initial[index].match.scenePlants.find(state => state.sourcePlacementId === '327');
  const final = run.finalWorld[index].match.scenePlants.find(state => state.sourcePlacementId === '327');
  assert(initial.enabled && !initial.hidden);
  assert(final.enabled && final.hidden);
  assert.equal(final.sourceModel, 'obj05413');
  const before = observed.rootStates.find(state => !state.hidden);
  const after = observed.rootStates.find(state => state.hidden);
  assert(before.rootEnabled && after.enabled && !after.rootEnabled);
  assert.equal(after.owners, 29);
  assert.equal(observed.draws.count, after.drawCount);
  assert.equal(observed.draws.lastFrame, after.lastDrawFrame);
  assert.equal(observed.snapshots.length, 0);
  return {side: index, initial, final, before, after, finalDraws: observed.draws,
    priorDrawObserved: after.drawCount > 0, countStableAfterHidden: true};
});
assert(run.cleanup.every(row => Object.values(row).every(value => value === 0)));
assert(run.plantOwnerCleanup.every(row => row.roots === 0 && row.snapshots === 0 && row.round === null));
for (const environment of run.environmentAfterLeave) {
  assert(environment.lifecycle.some(row => row.kind === 'plantDispose' && row.owners === 0 && row.resources === 0 && !row.materialOwner));
  assert(environment.lifecycle.some(row => row.kind === 'soundClear' && row.voices === 0 && !row.master && !row.map && row.oldAudioPaused.every(voice => voice.paused)));
}
writeFileSync('recovery/output/scene-plant02-contact-actual.json', JSON.stringify({
  status: 'FINITE_MAP02_PLANT327_CONTACT_VISIBILITY_DUAL_LEAVE_OBSERVER_FILTER_GAP',
  raw, rawStatus: run.status, rawFailures: run.failures, event, sides,
  movement: {before: priorInput, after: hiddenHost, afterTick: run.hiddenWorld.tick},
  cleanup: run.cleanup, plantOwnerCleanup: run.plantOwnerCleanup,
  observationGap: 'The observer tested MsgRoomSnapshot.mapId instead of roomInfo.mapId; snapshots[] is retained. Existing finalWorld snapshots and rootStates are verified without another browser run.',
  limitations: [
    'Host had6 actual source327 draws before hiding, with count/lastFrame unchanged after the recorded wait. Guest had0 target draws; state-disabled only.',
    'No independently attributed before/after Plant pixels, water animation, reentry, HD or original policy equivalence.',
    'Four BG voices are environmental sources, not Plant contact effects or sounds.',
  ],
}, null, 2) + '\n');
console.log('FINITE_MAP02_PLANT327_CONTACT_VISIBILITY_DUAL_LEAVE_OBSERVER_FILTER_GAP');
