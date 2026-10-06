import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

interface Hit {type: string; targetId: string; shotPlayerResult?: {itemId: number}; value: number; skillId?: number; hurtSelector?: number;}
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
  purchase: {instanceId: string; balance: string}; inventoryBefore: {item: string; slot: string}; inventoryAfter: {item: string; slot: string}; balanceAfter: string;
  beforeHeal: {players: {id: string; hp: number; maxHp: number}[]}; afterHeal: {players: {id: string; hp: number; maxHp: number; alive: boolean}[]}[];
  cleanup: {instances: number; meshes: number; voices: number; skillVoices: number; state: string}[];
}
const rawPath = 'recovery/output/browser-combat-shot-player-result-2009-2026-10-04T19-53-20-818Z.json';
const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawEvidence;
assert.equal(raw.status, 'PASS_LIMITED_PLAYER_SCOPE');
assert.equal(raw.sameHit.length, 1);
const hit = raw.sameHit[0];
assert.equal(hit.type, 'playerHealed'); assert.equal(hit.shotPlayerResult?.itemId, 2009);
assert.equal(hit.skillId, 4007); assert.equal(hit.hurtSelector, undefined); assert.equal(hit.value, 43);
assert(Number(raw.purchase.instanceId) > 0); assert(raw.purchase.balance.includes('金币：90 · 软星币：0')); assert(raw.balanceAfter.includes('金币：90 · 软星币：0'));
assert(raw.inventoryBefore.item.includes('×2')); assert(raw.inventoryAfter.item.includes('×1')); assert.equal(raw.inventoryBefore.slot, raw.purchase.instanceId); assert.equal(raw.inventoryAfter.slot, raw.purchase.instanceId);
const before = raw.beforeHeal.players.find(p => p.id === hit.targetId)!; assert.equal(before.hp, 157);
for (const side of raw.afterHeal) {const target = side.players.find(p => p.id === hit.targetId)!; assert(target.alive); assert.equal(target.hp, target.maxHp); assert.equal(target.hp - before.hp, hit.value);}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const required = [2664, 2665, 2667, 2830, 2834];
const sides = raw.observed.map((side, index) => {
  assert.equal(side.effects.length, 1); assert.equal(side.sounds.length, 1);
  const effect = side.effects[0], sound = side.sounds[0];
  assert(same(effect.result.event, hit)); assert(same(sound.result.event, hit));
  assert.equal(effect.root, 2637); assert(effect.liveParent && effect.expired);
  assert.deepEqual(effect.nodes, required);
  for (const node of required) assert(effect.rendered.includes(node));
  assert.equal(sound.reference, 'GA15'); assert.equal(sound.selector, 1);
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
writeFileSync('recovery/output/combat-shot-player-result-2009-actual.json', JSON.stringify({
  status: 'PASS_LIMITED_PLAYER_SCOPE', tasklist: ['M4-09', 'M4-10'], raw: rawPath,
  source: 'combat-shot-player-result-2009-source.json',
  module: ['combat-shot-player-result-2009.json'], runtime: 'combat-shot-player-result-2009-runtime.json',
  hit, sides, purchase: raw.purchase, inventoryBefore: raw.inventoryBefore, inventoryAfter: raw.inventoryAfter, balanceAfter: raw.balanceAfter, medicalScope: {beforeHP: before.hp, restored: hit.value, maxHP: before.maxHp, fullUncapped300Verified: false}, pixelReview: 'Both320x180 early/smoke canvases inspected: original green healing rings/particles in early and later real frames',
  nodeScope: 'All5 original linked drawing nodes submitted on both pages',
  fixture: 'Original tank1/pet1 ownership plus funds100/0 pre-room fixture; empty ammo inventory then formal Shop BUY2 and Home real instance1/slot1',
  missing: ['HD/all original states', 'original Target5/Func2/full medical authority policy', 'original damage/flight/server policy',
    'HD/all states'],
  parentsComplete: false,
}, null, 2) + '\n');
console.log('PASS_LIMITED_PLAYER_SCOPE 2009 dual original healing rings/particles/GA15/natural end/Leave');
