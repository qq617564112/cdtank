import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
import {EffectLifecycleHooks, EffectNodeLifecycle} from '../apps/web/src/render/effects/runtime/effect-lifecycle';
interface Event {event: string; delta?: number; controller?: number;}
interface Row {
  timing: EffectTimelineConfig;
  retain: boolean;
  steps: {delta: number; events: Event[]; phase: number; elapsed: number; controller: number}[];
}
const native: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/effect-lifecycle-native.json', 'utf8'));
const events: Event[] = [];
const hooks: EffectLifecycleHooks = {
  start: () => {},
  activate: () => events.push({event: 'activate'}),
  reset: (_, controller) => events.push({event: 'reset', controller}),
  update: (_, delta) => events.push({event: 'update', delta}),
  end: () => events.push({event: 'end'}),
  release: () => events.push({event: 'release'}),
  additionalEnd: () => false,
};
for (const row of native.rows) {
  const node = new EffectNodeLifecycle(row.timing, hooks, row.retain);
  node.start();
  for (const step of row.steps) {
    events.length = 0;
    node.tick(step.delta);
    assert.deepEqual(events, step.events);
    assert.equal(node.phase, step.phase);
    assert.equal(node.elapsed, step.elapsed);
    assert.equal(node.controller, step.controller);
  }
}
console.log(`PASS: ${native.rows.length} native lifetime/dispatch sequences, ${native.rows.length * 9} ticks`);
interface TreeRow {
  timings: EffectTimelineConfig[];
  retainedRoot: boolean;
  steps: {delta: number; events: (Event & {node: number})[];
    states: {phase: number; elapsed: number; controller: number}[]; childCount: number}[];
}
const trees: {trees: TreeRow[]} = JSON.parse(readFileSync('recovery/output/effect-lifecycle-native.json', 'utf8'));
for (const tree of trees.trees) {
  const treeEvents: (Event & {node: number})[] = [];
  const nodes: EffectNodeLifecycle[] = [];
  const emit = (node: EffectNodeLifecycle, event: Event) => treeEvents.push({...event, node: nodes.indexOf(node)});
  const treeHooks: EffectLifecycleHooks = {
    start: node => emit(node, {event: 'start'}),
    activate: node => emit(node, {event: 'activate'}),
    reset: (node, controller) => emit(node, {event: 'reset', controller}),
    update: (node, delta) => emit(node, {event: 'update', delta}),
    end: node => emit(node, {event: 'end'}),
    release: node => emit(node, {event: 'release'}),
    additionalEnd: () => false,
  };
  for (const [index, timing] of tree.timings.entries()) {
    nodes.push(new EffectNodeLifecycle(timing, treeHooks, index === 0 && tree.retainedRoot));
  }
  nodes[0].attach(nodes[1]);
  nodes[0].attach(nodes[2]);
  nodes[0].start();
  for (const step of tree.steps) {
    treeEvents.length = 0;
    nodes[0].tick(step.delta);
    assert.deepEqual(treeEvents, step.events);
    assert.deepEqual(nodes.map(node => ({phase: node.phase, elapsed: node.elapsed,
      controller: node.controller})), step.states);
    assert.equal(nodes[0].children.length, step.childCount);
  }
}
console.log(`PASS: ${trees.trees.length} native parent/child trees, reverse start/update, delayed start, retained root and release order`);
