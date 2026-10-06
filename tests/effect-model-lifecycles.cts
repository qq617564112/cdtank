import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EffectModelNodeState, EffectModelControl} from '../apps/web/src/render/effects/models/effect-model-node';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface ModelState {
  position: EffectVec3;
  velocity: EffectVec3;
  orbitOffset: EffectVec3;
  angles: EffectVec3;
  scale: EffectVec3;
  alpha: number;
}
interface Row {
  node: number;
  timing: EffectTimelineConfig;
  controls: EffectModelControl[];
  matrix: number[];
  hasParent: boolean;
  origin: EffectVec3;
  started: {state: ModelState; events: object[]};
  steps: {delta: number; phase: number; elapsed: number; controller: number; state: ModelState; events: object[]}[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-model-lifecycles-native.json', 'utf8')) as {rows: Row[]};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
for (const row of native.rows) {
  let events: object[] = [];
  const definition = {...library.nodes.find(node => node.index === row.node)!, children: []};
  const tree = new EffectRuntimeTree({...library, nodes: [definition]}, definition.id, row.origin,
    row.hasParent ? row.matrix : undefined, () => 0,
    {play: () => 0, finished: () => true, stop: () => {}}, {},
    () => events.push({kind: 'release'}), undefined, undefined, () => ({
      setTime: time => events.push({kind: 'setTime', time}),
      setRate: rate => events.push({kind: 'setRate', rate}),
      update: () => events.push({kind: 'update'}),
    }), row.matrix);
  const model = tree.root.model!;
  const lifecycle = tree.root.lifecycle;
  const state = (): ModelState => ({position: model.position, velocity: model.velocity,
    orbitOffset: model.orbitOffset, angles: model.angles, scale: model.scale, alpha: model.alpha});
  tree.start();
  assert.deepEqual(state(), row.started.state, `node${row.node} start`);
  assert.deepEqual(events, row.started.events);
  for (const [index, step] of row.steps.entries()) {
    events = [];
    tree.update(step.delta);
    assert.equal(lifecycle.phase, step.phase, `phase${index}`);
    assert.equal(lifecycle.elapsed, step.elapsed, `elapsed${index}`);
    assert.equal(lifecycle.controller, step.controller, `controller${index}`);
    assert.deepEqual(state(), step.state, `node${row.node} parent${row.hasParent} state${index}`);
    assert.deepEqual(events, step.events);
  }
}
console.log(`PASS: ${native.rows.length} production source trees / original type5 model lifecycles`);
