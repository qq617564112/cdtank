import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectNodeLifecycle} from '../apps/web/src/render/effects/runtime/effect-lifecycle';
import {EffectSoundNodeState, EffectSoundStore} from '../apps/web/src/render/effects/runtime/effect-sound-node';
import {EffectTimelineConfig} from '../apps/web/src/render/effects/runtime/effect-timeline';
interface Event {kind: string; handle?: number; result?: boolean; reference?: string; parameter?: number;}
interface Row {
  node: number;
  timing: EffectTimelineConfig;
  reference: string;
  parameter: number;
  stopPrevious: boolean;
  steps: {delta: number; finished: boolean; events: Event[]; phase: number; elapsed: number;
    controller: number; started: boolean; handle: number}[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-sound-lifecycles-native.json', 'utf8')) as {rows: Row[]};
const shared: EffectSoundStore<number> = {};
let nextHandle = 0;
for (const row of native.rows) {
  let events: Event[] = [], finished = false;
  const sound = new EffectSoundNodeState(row.reference, row.parameter, row.stopPrevious, {
    play: (reference, parameter) => {
      const handle = ++nextHandle;
      events.push({kind: 'play', reference, parameter, handle});
      return handle;
    },
    finished: handle => {events.push({kind: 'finished', handle, result: finished}); return finished;},
    stop: handle => events.push({kind: 'stop', handle}),
  }, shared);
  const lifecycle = new EffectNodeLifecycle(row.timing, {
    start: () => sound.start(), activate: () => {}, reset: () => {}, update: () => sound.update(),
    end: () => sound.end(), release: () => events.push({kind: 'release'}),
    additionalEnd: (_, lifetimeEnded) => sound.additionalEnd(lifetimeEnded),
  });
  lifecycle.start();
  for (const [index, step] of row.steps.entries()) {
    events = [];
    finished = step.finished;
    lifecycle.tick(step.delta);
    const message = `node${row.node} tick${index}`;
    assert.equal(lifecycle.phase, step.phase, message);
    assert.equal(lifecycle.elapsed, step.elapsed, message);
    assert.equal(lifecycle.controller, step.controller, message);
    assert.equal(sound.started, step.started, message);
    if (sound.handle !== undefined) assert.equal(sound.handle, step.handle, message);
    assert.deepEqual(events, step.events, message);
  }
}
console.log(`PASS: ${native.rows.length} complete original type4 sound lifecycles and backend calls`);
