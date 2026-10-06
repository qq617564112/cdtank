import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

const path = 'recovery/output/browser-combat-shot-player-result-2007-2026-10-04T18-49-38-188Z.json';
const raw = JSON.parse(readFileSync(path, 'utf8'));
assert.equal(raw.status, 'PASS');
assert.equal(raw.playerRoute, 'two normal accounts; host sole shooter; no CPU');
assert.equal(raw.sameHit.length, 1);
assert.equal(raw.sameHit[0].shotPlayerResult.itemId, 2007);
const epoch = raw.observed[0].effects[0].burn.burn;
const sides = raw.observed.map((side: any, index: number) => {
  assert.equal(side.effects.length, 1, 'retained epoch starts once and revive does not replay');
  const effect = side.effects[0], sound = side.sounds[0];
  assert.deepEqual(effect.burn.burn, epoch);
  assert.equal(effect.root, 2449); assert.equal(effect.liveParent, true);
  assert.deepEqual([...effect.rendered].sort(), [2450, 2451, 2452]);
  assert(Object.values(effect.vertices).every((value: any) => value > 0));
  assert(Object.values(effect.textures).every(Boolean));
  assert(effect.stopped && effect.released);
  assert.equal(side.sounds.length, 1);
  assert.equal(sound.reference, 'SE03'); assert.equal(sound.selector, -1);
  assert(sound.loop && sound.played && sound.stopped);
  assert(sound.outputPeak > 0 && sound.postGainPeak > 0);
  const target = effect.burn.id;
  const stop = effect.stopSnapshot.players.find((p: any) => p.id === target);
  assert.equal(stop.alive, false); assert.equal(stop.hp, 0); assert(!stop.ammoBurn);
  const history = side.snapshots.map((s: any) => ({tick: s.tick, serverTime: s.serverTime,
    ...s.players.find((p: any) => p.id === target)}));
  assert(history.some((p: any) => p.alive && p.ammoBurn?.startedAt === epoch.startedAt));
  assert(history.some((p: any) => !p.alive && !p.ammoBurn));
  assert(history.some((p: any) => p.alive && p.serverTime > effect.stopSnapshot.serverTime && !p.ammoBurn));
  assert.deepEqual(raw.cleanup[index], {instances: 0, meshes: 0, voices: 0, skillVoices: 0, state: 'stopped'});
  const capture = path.replace('.json', `-natural-${index + 1}-${effect.handle}.png`);
  assert(readFileSync(capture).length > 0);
  return {target, epoch, handle: effect.handle, capture,
    stopReason: 'natural burn death; living expiry not proved',
    stopTick: effect.stopSnapshot.tick, stopServerTime: effect.stopSnapshot.serverTime,
    expiresAt: epoch.expiresAt, history,
    sound: {reference: sound.reference, selector: sound.selector, outputPeak: sound.outputPeak,
      postGainPeak: sound.postGainPeak, stopped: sound.stopped}, cleanup: raw.cleanup[index]};
});
writeFileSync('recovery/output/ammo-burn-presentation-actual.json', JSON.stringify({
  status: 'PASS_LIMITED_PLAYER_SCOPE', tasklist: ['M4-09', 'M4-10'], raw: path,
  source: 'skill-effect-message retained4005 slot0/tuple/stop; published014',
  module: ['ammo-burn-presentation.json', 'ammo-burn-presentation-runtime.json'],
  sides, pixelReview: 'Both full natural canvases inspected: attached original flame/smoke on victim',
  fixture: 'Pre-room original tank1/pet1; 2007 inventory15 instance77 slot2, not formal BUY',
  authority: 'Mainline explicit rebuilt burn/damage/flight/9sec policy; no active injection',
  missing: ['living natural expiry', 'normal injection cancellation', 'burn round reset',
    'skill4005 second slot7/SE30', 'full original server/damage/flight', 'HD/all states'],
  rawFailuresPreserved: ['18-45-44 map dynamic module entry', '18-46-56 death before014 delay'],
  parentsComplete: false,
}, null, 2) + '\n');
console.log('PASS_LIMITED_PLAYER_SCOPE normal2007/dual014/SE03/death stop/revive no replay/Leave');
