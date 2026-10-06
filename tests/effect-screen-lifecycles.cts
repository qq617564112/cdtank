import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectScreenConfig, EffectScreenBackend} from '../apps/web/src/render/effects/runtime/effect-screen-node';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
import {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
interface Row {
  timing: EffectTimelineConfig;
  config: EffectScreenConfig;
  node: number;
  steps: {delta: number; phase: number; elapsed: number; controller: number; events: object[]}[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-screen-lifecycles-native.json', 'utf8')) as {rows: Row[]};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
for (const row of native.rows) {
  let events: object[] = [];
  const backend: EffectScreenBackend = {
    selectEffect: (index, parameter) => events.push({kind: 'selectEffect', index, parameter}),
    clearEffect: () => events.push({kind: 'clearEffect'}),
    shake: (parameter, lifetime, strength) => events.push({kind: 'shake', parameter, lifetime, strength}),
  };
  const tree = new EffectRuntimeTree(library, library.nodes[row.node].id,
    [0, 0, 0], undefined, () => {throw new Error('Unexpected RNG');},
    {play: () => 0, finished: () => true, stop: () => {}}, {},
    () => events.push({kind: 'release'}), undefined, backend);
  const actualLifecycle = tree.root.lifecycle;
  actualLifecycle.start();
  for (const [index, step] of row.steps.entries()) {
    events = [];
    actualLifecycle.tick(step.delta);
    assert.equal(actualLifecycle.phase, step.phase, `phase${index}`);
    assert.equal(actualLifecycle.elapsed, step.elapsed, `elapsed${index}`);
    assert.equal(actualLifecycle.controller, step.controller, `controller${index}`);
    assert.deepEqual(events, step.events);
  }
}
console.log(`PASS: ${native.rows.length} complete original type10/type11 source lifecycles`);
