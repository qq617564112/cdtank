import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

const rawPath = process.argv[2];
assert(rawPath, 'Provide the unchanged first ordinary2004 raw path');
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
assert.equal(raw.status, 'PARTIAL_CLIPPED');
assert.equal(raw.ammo, 2004); assert.equal(raw.mapId, 7);
assert.equal(raw.auxiliaryPlayers.length, 2);
assert(raw.purchase.balance.includes('金币：75 · 软星币：0'));
assert(Number(raw.purchase.instanceId) > 0);
assert(raw.inventoryBefore.item.includes('×5'));
assert.equal(raw.inventoryBefore.slot, raw.purchase.instanceId);
const [local, remote] = raw.observed;
assert.equal(local.results.length, 1); assert.equal(remote.results.length, 1);
const event = remote.results[0].event;
assert.deepEqual(local.results[0].event, event);
assert.equal(event.type, 'sceneObjectDestroyed'); assert.equal(event.targetId, 'ENV:79');
assert.equal(event.shotItemResult.itemId, 2004);
assert.deepEqual([event.shotItemResult.x, event.shotItemResult.y, event.shotItemResult.z], [event.x, event.y, event.z]);
assert(local.results[0].local); assert.equal(local.results[0].feedback, 0);
assert.deepEqual(local.effects, []); assert.deepEqual(local.sounds, []);
assert.equal(local.gaSounds?.length ?? 0, 0);
assert.equal(remote.results[0].local, false); assert.equal(remote.results[0].feedback, 1);
assert.equal(remote.effects.length, 1);
const effect = remote.effects[0];
assert.equal(effect.root, 2432); assert(effect.world && effect.expired);
const required = [2433, 2434, 2435, 2447, 2448];
assert.deepEqual([...effect.nodes].sort(), [...required].sort());
for (const node of [2433, 2434, 2435, 2447]) assert(effect.rendered.includes(node));
assert.equal(effect.rendered.includes(2448), false);
assert.deepEqual(effect.result.event, event);
assert.equal(remote.sounds.length, 1);
const sound = remote.sounds[0];
assert.equal(sound.reference, 'SE30'); assert.equal(sound.parameter, 1);
assert(sound.played && sound.ended && sound.outputPeak > 0);
assert.equal(sound.muted, false); assert(sound.audioVolume > 0);
assert.equal(remote.gaSounds.length, 1);
const feedback = remote.gaSounds[0];
assert.equal(feedback.soundId, 48); assert.equal(feedback.skillId, 2004);
assert.equal(feedback.loop, false); assert(feedback.ended && feedback.postGainPeak > 0);
const attacker = raw.finalWorld[1].players.find((p: {id: string}) => p.id === event.playerId);
assert.deepEqual([feedback.x, feedback.y, feedback.z], [attacker.x, attacker.y, attacker.z]);
for (const world of raw.finalWorld) {
  assert.equal(world.match.sceneObjects.find((o: {id: string}) => o.id === 'ENV:79').hp, 0);
  const owner = world.players.find((p: {id: string}) => p.id === event.playerId);
  assert.equal(owner.ammoSlots.find((a: {slot: number}) => a.slot === 2).quantity, 0);
  assert.equal(owner.ammoItemId, 2004, 'Actual final selection remains2004 after stopping at empty stock');
}
for (const side of raw.observed) {
  assert(side.brokenDraws.length > 0);
  assert(side.sceneSounds.some((s: {reference: string; played: boolean; ended: boolean}) => s.reference === 'GA41' && s.played && s.ended));
}
for (const counts of raw.cleanup) assert.deepEqual(counts, {instances: 0, meshes: 0, voices: 0, state: 'stopped'});
const capture = null;
writeFileSync('recovery/output/combat-shot-item-result-2004-actual.json', JSON.stringify({
  status: 'PASS_TRANSACTION_AUDIO_CLEANUP_ONLY', tasklist: ['M4-09', 'M4-10'], raw: rawPath,
  sourceContract: 'scene-breach21-hit-native.json',
  module: 'combat-shot-item-result-2004.json',
  resourceReuse: ['combat-shot-player-result-2004-source.json', 'ordinary2001-immediate-accepted.json'],
  lastShotEmptyStockWithFrozen2004Verified: true, snapshotFallbackOrdinaryVerified: false, finalSelectedAmmo: [2004, 2004], event, purchase: raw.purchase, configured: raw.inventoryBefore,
  stockScope: {purchased: 5, ordinaryShots: 5, finalAuthoritativeQuantity: 0, postLeaveHomeOrRestartNewlyVerified: false},
  local: {resultFeedback: 0, resultTrees: 0, resultSounds: 0},
  remote: {capture, root: effect.root, rendered: effect.rendered, endpoint: event.shotItemResult,
    world: effect.world, naturalEnd: effect.expired,
    planarSE30: {played: sound.played, ended: sound.ended, captureStreamPeak: sound.outputPeak,
      audioVolume: sound.audioVolume, muted: sound.muted},
    GA07: {soundId: feedback.soundId, ended: feedback.ended, postAttenuationPeak: feedback.postGainPeak,
      position: [feedback.x, feedback.y, feedback.z]}},
  cleanup: raw.cleanup,
  visibleOutputAccepted: false, missingDrawNodes: [2448],
  pixelReview: 'No active result canvas saved; full-node capture gate remained closed. Actual draws do not establish visible output.',
  fixture: raw.fixture,
  missing: ['HD/all original states', 'original projectile/HP/destruction/server policy', 'all special ammo scene results', 'ordinary Digit1 or empty-fire fallback not exercised', 'active result canvas pixels', 'short node2448 actual submit'],
  parentsComplete: false,
}, null, 2) + '\n');
console.log('PASS_TRANSACTION_AUDIO_CLEANUP_ONLY 2004 scene007/2DSE30/GA07/local silence/Leave; pixels unverified');
