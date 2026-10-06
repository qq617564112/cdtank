import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

const rawPath = 'recovery/output/browser-combat-shot-item-result-2002-2026-10-04T20-09-15-941Z.json';
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
assert.equal(raw.status, 'PASS');
assert.equal(raw.ammo, 2002); assert.equal(raw.mapId, 7);
assert.equal(raw.auxiliaryPlayers.length, 2);
assert(raw.purchase.balance.includes('金币：70 · 软星币：0'));
assert(Number(raw.purchase.instanceId) > 0);
assert(raw.inventoryBefore.item.includes('×6'));
assert.equal(raw.inventoryBefore.slot, raw.purchase.instanceId);
const [local, remote] = raw.observed;
assert.equal(local.results.length, 1); assert.equal(remote.results.length, 1);
const event = remote.results[0].event;
assert.deepEqual(local.results[0].event, event);
assert.equal(event.type, 'sceneObjectDestroyed'); assert.equal(event.targetId, 'ENV:79');
assert.equal(event.shotItemResult.itemId, 2002);
assert.deepEqual([event.shotItemResult.x, event.shotItemResult.y, event.shotItemResult.z], [event.x, event.y, event.z]);
assert(local.results[0].local); assert.equal(local.results[0].feedback, 0);
assert.deepEqual(local.effects, []); assert.deepEqual(local.sounds, []);
assert.equal(local.gaSounds?.length ?? 0, 0);
assert.equal(remote.results[0].local, false); assert.equal(remote.results[0].feedback, 1);
assert.equal(remote.effects.length, 1);
const effect = remote.effects[0];
assert.equal(effect.root, 2742); assert(effect.world && effect.expired);
const required = [2743, 2744, 2745, 2746, 2747, 2757];
assert.deepEqual([...effect.nodes].sort(), [...required].sort());
for (const node of required) assert(effect.rendered.includes(node));
assert.deepEqual(effect.result.event, event);
assert.equal(remote.sounds.length, 1);
const sound = remote.sounds[0];
assert.equal(sound.reference, 'SE31'); assert.equal(sound.parameter, 1);
assert(sound.played && sound.ended && sound.outputPeak > 0);
assert.equal(sound.muted, false); assert(sound.audioVolume > 0);
assert.equal(remote.gaSounds.length, 1);
const feedback = remote.gaSounds[0];
assert.equal(feedback.soundId, 51); assert.equal(feedback.skillId, 2002);
assert.equal(feedback.loop, false); assert(feedback.ended && feedback.postGainPeak > 0);
const attacker = raw.finalWorld[1].players.find((p: {id: string}) => p.id === event.playerId);
assert.deepEqual([feedback.x, feedback.y, feedback.z], [attacker.x, attacker.y, attacker.z]);
for (const world of raw.finalWorld) {
  assert.equal(world.match.sceneObjects.find((o: {id: string}) => o.id === 'ENV:79').hp, 0);
  assert.equal(world.players.find((p: {id: string}) => p.id === event.playerId).ammoSlots.find((a: {slot: number}) => a.slot === 2).quantity, 1);
}
for (const side of raw.observed) {
  assert(side.brokenDraws.length > 0);
  assert(side.sceneSounds.some((s: {reference: string; played: boolean; ended: boolean}) => s.reference === 'GA41' && s.played && s.ended));
}
for (const counts of raw.cleanup) assert.deepEqual(counts, {instances: 0, meshes: 0, voices: 0, state: 'stopped'});
const capture = rawPath.replace('.json', '-result-canvas-2.png');
assert(readFileSync(capture).length > 0);
writeFileSync('recovery/output/combat-shot-item-result-2002-actual.json', JSON.stringify({
  status: 'PASS_LIMITED_PLAYER_SCOPE', tasklist: ['M4-09', 'M4-10'], raw: rawPath,
  sourceContract: 'combat-shot-item-result-2002-source-contract.json',
  module: 'combat-shot-item-result-2002.json',
  resourceReuse: ['combat-shot-player-result-2002-source.json', 'combat-shot-player-result-2002-runtime.json'],
  event, purchase: raw.purchase, configured: raw.inventoryBefore,
  stockScope: {purchased: 6, ordinaryShots: 5, finalAuthoritativeQuantity: 1, postLeaveHomeOrRestartNewlyVerified: false},
  local: {resultFeedback: 0, resultTrees: 0, resultSounds: 0},
  remote: {capture, root: effect.root, rendered: effect.rendered, endpoint: event.shotItemResult,
    world: effect.world, naturalEnd: effect.expired,
    planarSE31: {played: sound.played, ended: sound.ended, captureStreamPeak: sound.outputPeak,
      audioVolume: sound.audioVolume, muted: sound.muted},
    GA10: {soundId: feedback.soundId, ended: feedback.ended, postAttenuationPeak: feedback.postGainPeak,
      position: [feedback.x, feedback.y, feedback.z]}},
  cleanup: raw.cleanup,
  pixelReview: 'Original008 bright explosion/fire/smoke inspected in the complete320x180 remote canvas; local result is silent by original branch.',
  fixture: raw.fixture,
  missing: ['HD/all original states', 'original projectile/HP/destruction/server policy', 'all special ammo scene results'],
  parentsComplete: false,
}, null, 2) + '\n');
console.log('PASS_LIMITED_PLAYER_SCOPE 2002 remote scene008/2DSE31/GA10/local silence/Leave');
