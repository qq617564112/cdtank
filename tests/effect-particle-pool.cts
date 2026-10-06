import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectParticlePool} from '../apps/web/src/render/effects/particles/effect-particle-pool';
interface Particle {id: number; visible: boolean; age: number; lifetime: number; updates: number;}
interface Row {initial: Particle[]; steps: {delta: number; updated: number[]; states: Particle[]}[];}
const native: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/effect-pool-native.json', 'utf8'));
for (const row of native.rows) {
  const pool = new EffectParticlePool<Particle>(row.initial.length, state => ({...state}));
  let index = 0;
  assert.equal(pool.emit(row.initial.length, () => ({...row.initial[index++]})), row.initial.length);
  let overflowCalls = 0;
  assert.equal(pool.emit(3, () => {++overflowCalls; return {...row.initial[0]};}), 0);
  assert.equal(overflowCalls, 0);
  for (const step of row.steps) {
    const updated: number[] = [];
    pool.update(step.delta, particle => {
      updated.push(particle.id);
      return {...particle, updates: particle.updates + 1};
    });
    assert.deepEqual(updated, step.updated);
    assert.deepEqual(pool.particles, step.states);
  }
}
console.log(`PASS: ${native.rows.length} original forward particle loops, tail-swap skip, equality, invisible age/update and capacity`);
