import assert from 'node:assert/strict';
import {SceneCastlePresentation} from '../apps/web/src/assets/scenes/scene-castle-presentation';
import type {CastleEffectTarget} from '../apps/web/src/assets/scenes/scene-castle-state';
const matrices = new Map<CastleEffectTarget, number[]>();
for (const [index, key] of (['root', 0, 1, 2, 3, 4] as const).entries()) {
  matrices.set(key, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, index * 10, 20, -index, 1]);
}
let sequence = 0;
const effects = new Map<number, {name: string; matrix: readonly number[]}>();
const voices = new Map<number, {name: string; selector: number; position: number[]}>();
const stoppedEffects: number[] = [];
const stoppedSounds: number[] = [];
const owner = new SceneCastlePresentation({position: [1, 2, 3],
  matrix: target => matrices.get(target)!, action: () => {}, damageText: () => {}, destroyCallback: () => {},
}, {
  spawnCastleEffect(name, matrix) {const handle = ++sequence; effects.set(handle, {name, matrix}); return handle;},
  stopEffect(handle) {stoppedEffects.push(handle); effects.delete(handle);},
  playSceneSound(name, position, selector = 1) {const handle = ++sequence;
    voices.set(handle, {name, selector, position: [...position]}); return handle;},
  stopSkillSound(handle) {stoppedSounds.push(handle); voices.delete(handle);},
});
owner.damage({currentHP: 1600, maxHP: 2000, delta: 400});
const smoke = [...effects.values()].find(e => e.name === '040')!;
assert.equal(smoke.matrix, matrices.get(0), 'Original tag matrix reference remains live');
matrices.get(0)![12] = 125;
assert.equal(smoke.matrix[12], 125);
const loop = [...voices.values()].find(v => v.selector === -1)!;
assert.deepEqual(loop.position, matrices.get(3)!.slice(12, 15), 'Original se03 uses spout4 position');
const before = effects.size;
owner.damage({currentHP: 1500, maxHP: 2000, delta: 100});
assert.equal(effects.size, before, 'Same fifth does not add another effect');
owner.damage({currentHP: 0, maxHP: 2000, delta: 1500});
assert(![...voices.values()].some(v => v.selector === -1), 'Death stops persistent Castle sounds');
assert(stoppedEffects.length > 0);
owner.dispose();
assert.equal(effects.size, 0);
assert.equal(voices.size, 0);
assert(stoppedSounds.length > 0);
console.log('PASS: Castle live tag references, original spatial sound target, repeated-stage isolation and owner cleanup');
