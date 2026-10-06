import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

interface Hit {type: string; targetId: string; shotPlayerResult?: {itemId: number};}
interface EffectEvidence {
  handle: number;
  root: number;
  owner: string;
  result: {event: Hit; position: number[]};
  nodes: number[];
  rendered: number[];
  liveParent: boolean;
  expired: boolean;
}
interface SoundEvidence {
  result: {event: Hit; position: number[]};
  reference: string;
  selector: number;
  position: number[];
  loop: boolean;
  played: boolean;
  ended: boolean;
  outputPeak: number;
  postGainPeak: number;
}
interface RawEvidence {
  status: string;
  sameHit: Hit[];
  observed: {effects: EffectEvidence[]; sounds: SoundEvidence[]}[];
  cleanup: {instances: number; meshes: number; voices: number; skillVoices: number; state: string}[];
}
const rawPath = 'recovery/output/browser-combat-shot-player-result-2010-2026-10-04T19-38-40-942Z.json';
const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawEvidence;
assert.equal(raw.status, 'PASS_LIMITED_PLAYER_SCOPE');
assert.equal(raw.sameHit.length, 1);
const hit = raw.sameHit[0];
assert.equal(hit.type, 'hit'); assert.equal(hit.shotPlayerResult?.itemId, 2010);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const required = [2752];
const sides = raw.observed.map((side, index) => {
  assert.equal(side.effects.length, 1); assert.equal(side.sounds.length, 1);
  const effect = side.effects[0], sound = side.sounds[0];
  assert(same(effect.result.event, hit)); assert(same(sound.result.event, hit));
  assert.equal(effect.root, 2748); assert(effect.liveParent && effect.expired);
  assert.deepEqual(effect.nodes, required);
  for (const node of required) assert(effect.rendered.includes(node));
  assert.equal(sound.reference, 'SE14'); assert.equal(sound.selector, 1);
  assert.equal(sound.loop, false); assert(sound.played && sound.ended);
  assert.deepEqual(sound.position, sound.result.position);
  assert(sound.outputPeak > 0 && sound.postGainPeak > 0);
  const capture = rawPath.replace('.json', `-natural-${index + 1}-${effect.handle}-early.png`);
  assert(readFileSync(capture).length > 0);
  assert.deepEqual(raw.cleanup[index], {instances: 0, meshes: 0, voices: 0, skillVoices: 0, state: 'stopped'});
  return {capture, rendered: effect.rendered, missing: required.filter(node => !effect.rendered.includes(node)),
    liveParent: effect.liveParent, naturalEnd: effect.expired, sound: {
      reference: sound.reference, selector: sound.selector, postGainPeak: sound.postGainPeak,
      played: sound.played, ended: sound.ended}, cleanup: raw.cleanup[index]};
});
writeFileSync('recovery/output/combat-shot-player-result-2010-actual.json', JSON.stringify({
  status: 'PASS_LIMITED_PLAYER_SCOPE', tasklist: ['M4-09', 'M4-10'], raw: rawPath,
  source: 'combat-shot-player-result-2010-source.json',
  module: ['combat-shot-player-result-2010.json'], runtime: 'combat-shot-player-result-2010-runtime.json',
  hit, sides, pixelReview: 'Both320x180 early canvases inspected: original smoke in early and later real frames',
  nodeScope: 'Original linked drawing node2752 submitted on both pages',
  fixture: 'Original tank1/pet1 and2010 inventory15/instance77/slot2 pre-room fixture, not BUY',
  missing: ['HD/all original states', 'original radar interference/15sec state policy', 'original damage/flight/server policy',
    '2010 inventory consumption/BUY chain', 'HD/all states'],
  parentsComplete: false,
}, null, 2) + '\n');
console.log('PASS_LIMITED_PLAYER_SCOPE 2010 dual original smoke/SE14/natural end/Leave');
