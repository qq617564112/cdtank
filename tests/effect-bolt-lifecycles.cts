import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EffectBoltConfig, EffectBoltSegments} from '../apps/web/src/render/effects/bolts/effect-bolt-segments';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface State extends EffectBoltSegments {worldSegments: number[][]; remainder: number;}
interface Sample {state: State; randomValues: number[];}
interface Row {
  node: number;
  config: EffectBoltConfig & {interval: number};
  timing: EffectTimelineConfig;
  origin: EffectVec3;
  started: Sample;
  steps: (Sample & {delta: number; phase: number; elapsed: number; controller: number; events: object[]})[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-bolt-lifecycles-native.json', 'utf8')) as {rows: Row[]};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
for (const row of native.rows) {
  let events: object[] = [];
  let randomValues = row.started.randomValues;
  let randomIndex = 0;
  const definition = library.nodes[row.node];
  const tree = new EffectRuntimeTree(library, definition.id, row.origin, undefined, () => {
    assert.ok(randomIndex < randomValues.length);
    return randomValues[randomIndex++];
  }, {play: () => {throw new Error('Unexpected lightning sound');}, finished: () => true, stop: () => {}}, {},
  () => events.push({kind: 'release'}));
  const bolt = tree.root.bolt!;
  const lifecycle = tree.root.lifecycle;
  const state = (): State => ({...bolt.bolt, worldSegments: bolt.worldSegments, remainder: bolt.remainder});
  tree.start();
  assert.deepEqual(state(), row.started.state);
  assert.equal(randomIndex, randomValues.length);
  for (const [index, step] of row.steps.entries()) {
    events = [];
    randomValues = step.randomValues;
    randomIndex = 0;
    tree.update(step.delta);
    assert.equal(lifecycle.phase, step.phase);
    assert.equal(lifecycle.elapsed, step.elapsed);
    assert.equal(lifecycle.controller, step.controller);
    assert.deepEqual(state(), step.state, `node${row.node} step${index}`);
    assert.deepEqual(events, step.events);
    assert.equal(randomIndex, randomValues.length);
  }
}
console.log(`PASS: ${native.rows.length} original lightning full source lifecycles`);
