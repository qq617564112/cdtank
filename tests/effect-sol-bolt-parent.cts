import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectBoltConfig, EffectBoltSegments} from '../apps/web/src/render/effects/bolts/effect-bolt-segments';
import {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
interface State extends EffectBoltSegments {worldSegments: number[][]; remainder: number;}
interface Sample {matrix: number[]; delta: number; state: State; randomValues: number[]; frees: number[];}
interface Row {node: number; config: EffectBoltConfig & {interval: number}; samples: Sample[];}
const native = JSON.parse(readFileSync('recovery/output/effect-sol-bolt-parent-native.json', 'utf8')) as {rows: Row[]};
const source = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
for (const row of native.rows) {
  const definition = source.nodes[row.node];
  // A continuous original node isolates attached rebuilds from controller/lifetime boundaries.
  const library = {...source, nodeTimings: source.nodeTimings.map(timing => timing.node === row.node ?
    {...timing, delay: 0, lifetime: 0, controllers: []} : timing)};
  const parent = [...row.samples[0].matrix];
  let randomValues = row.samples[0].randomValues;
  let randomIndex = 0;
  const tree = new EffectRuntimeTree(library, definition.id, [99, -42, 31], parent, () => {
    assert.ok(randomIndex < randomValues.length, `unexpected rand node${row.node}`);
    return randomValues[randomIndex++];
  }, {play: () => {throw new Error('Unexpected sound');}, finished: () => true, stop: () => {}}, {});
  const bolt = tree.root.bolt!;
  for (const [index, sample] of row.samples.entries()) {
    parent.splice(0, parent.length, ...sample.matrix);
    randomValues = sample.randomValues;
    randomIndex = 0;
    if (index === 0) tree.start();
    else tree.update(sample.delta);
    assert.deepEqual({...bolt.bolt, worldSegments: bolt.worldSegments, remainder: bolt.remainder},
      sample.state, `node${row.node} sample${index}`);
    assert.equal(randomIndex, randomValues.length);
    assert.equal(sample.frees.length, sample.matrix.every(value => value === 0) ? 1 : 0);
  }
}
console.log(`PASS: ${native.rows.length} production source trees / ${native.rows.reduce((sum, row) => sum + row.samples.length, 0)} original attached bolt samples`);
