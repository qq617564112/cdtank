import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resetEffectEmitterSpace, startEffectEmitterSpace} from '../apps/web/src/render/effects/particles/effect-emitter-space';
import {EffectParticleNodeState, EffectParticleController} from '../apps/web/src/render/effects/particles/effect-particle-node';
import type {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Row {
  control: EffectParticleController;
  parent: boolean;
  globalRotation: number[];
  initial: number[];
  operation: 'start' | 'reset';
  state: number[];
  index: number;
  count: number;
  origin: number[];
  fraction: number;
  burst: boolean;
}
const source = JSON.parse(readFileSync('recovery/output/effect-emitter-reset-native.json', 'utf8')) as {rows: Row[]};
for (const row of source.rows) {
  const result = row.operation === 'start' ? startEffectEmitterSpace(row.control, [10, 20, 30],
    row.globalRotation, row.parent, row.initial.slice(3, 6) as EffectVec3) :
    resetEffectEmitterSpace({position: row.initial.slice(0, 3) as EffectVec3,
      orbitOffset: row.initial.slice(3, 6) as EffectVec3}, [7, 8, 9], row.control);
  assert.deepEqual([...result.position, ...result.orbitOffset].map(value => value === 0 ? 0 : value),
    row.state.map(value => value === 0 ? 0 : value), JSON.stringify(row));
  const node = new EffectParticleNodeState([row.control, row.control], [
    {position: row.initial.slice(0, 3) as EffectVec3, orbitOffset: row.initial.slice(3, 6) as EffectVec3},
    {position: [-4, -5, -6], orbitOffset: [7, 8, 9]}], [undefined, undefined], 150,
    () => {throw new Error('Start/reset must not consume random');}, row.globalRotation,
    row.parent ? Array<number>(16).fill(0) : undefined);
  node.emitter.fraction = .375;
  node.emitter.burstEmitted = true;
  if (row.operation === 'start') node.start([10, 20, 30]);
  else node.reset(1);
  assert.deepEqual([...node.spaces[row.index].position, ...node.spaces[row.index].orbitOffset]
    .map(value => value === 0 ? 0 : value), row.state.map(value => value === 0 ? 0 : value));
  assert.equal(node.emitter.fraction, row.fraction);
  assert.equal(node.emitter.burstEmitted, row.burst);
  assert.equal(row.count, 7);
  assert.equal(row.fraction, row.operation === 'start' ? 0 : .375);
  assert.equal(row.burst, row.operation === 'reset');
  assert.equal(row.index, row.operation === 'start' ? 0 : 1);
  assert.deepEqual(row.origin, row.operation === 'start' ? [10, 20, 30] : [100, 200, 300]);
}
console.log(`PASS: ${source.rows.length} complete original type6 world start/controller reset spaces`);
