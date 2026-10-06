import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectOverlayControl} from '../apps/web/src/render/effects/overlays/effect-overlay-node';
import {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
import {EffectColor} from '../apps/web/src/render/effects/common/types';
interface Row {
  timing: EffectTimelineConfig;
  controls: EffectOverlayControl[];
  steps: {delta: number; phase: number; elapsed: number; controller: number; color: EffectColor;
    frame: number; frameRemainder: number; events: {kind: string}[]}[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-overlay-lifecycle-native.json', 'utf8')) as {rows: Row[]};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
for (const row of native.rows) {
  let events: {kind: string}[] = [];
  const tree = new EffectRuntimeTree(library, library.nodes[905].id, [0, 0, 0], undefined,
    () => {throw new Error('Unexpected RNG');},
    {play: () => {throw new Error('Unexpected overlay sound');}, finished: () => true, stop: () => {}}, {},
    () => events.push({kind: 'release'}));
  const lifecycle = tree.root.lifecycle;
  const overlay = tree.root.overlay!;
  tree.start();
  for (const [index, step] of row.steps.entries()) {
    events = [];
    tree.update(step.delta);
    assert.equal(lifecycle.phase, step.phase, `phase${index}`);
    assert.equal(lifecycle.elapsed, step.elapsed, `elapsed${index}`);
    assert.equal(lifecycle.controller, step.controller, `controller${index}`);
    assert.equal(overlay.frame, step.frame, `frame${index}`);
    assert.equal(overlay.frameRemainder, step.frameRemainder, `clock${index}`);
    assert.deepEqual(overlay.color, step.color, `color${index}`);
    assert.deepEqual(events, step.events);
  }
}
console.log(`PASS: ${native.rows.length} complete original type8 overlay source lifecycles`);
