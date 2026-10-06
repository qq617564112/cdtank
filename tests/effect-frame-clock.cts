import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EffectFrameClock} from '../apps/web/src/render/effects/common/effect-frame-clock';

const library = JSON.parse(fs.readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const explosion = library.spriteControls.find((row: {node: number}) => row.node === 2431);
assert.equal(explosion.frameCount, 16);
assert.equal(explosion.frameFlags, 1);
assert.equal(explosion.frameInterval, Math.fround(.02));
const clock = new EffectFrameClock(explosion, () => {throw new Error('Unexpected random branch');});
assert.equal(clock.frame, 0);
assert.equal(clock.advance(explosion.frameInterval / 2), 0);
assert.equal(clock.advance(explosion.frameInterval / 2), 1);
assert.equal(clock.remainder, 0);
for (const expected of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 15]) {
  assert.equal(clock.advance(explosion.frameInterval), expected);
}
clock.reset();
assert.equal(clock.frame, 0);
assert.equal(clock.remainder, 0);
// Large deltas do not skip frames. Each subsequent zero delta consumes one step.
assert.equal(clock.advance(explosion.frameInterval * 8), 1);
assert.equal(clock.advance(0), 2);
assert.equal(clock.advance(0), 3);

const loop = new EffectFrameClock({frameCount: 3, frameInterval: .125, frameFlags: 0}, () => 0);
assert.deepEqual([loop.frame, loop.advance(.125), loop.advance(.125), loop.advance(.125)], [0, 1, 2, 0]);
const reverse = new EffectFrameClock({frameCount: 3, frameInterval: .125, frameFlags: 2}, () => 0);
assert.deepEqual([reverse.frame, reverse.advance(.125), reverse.advance(.125), reverse.advance(.125)], [2, 1, 0, 2]);
const reverseStop = new EffectFrameClock({frameCount: 3, frameInterval: .125, frameFlags: 3}, () => 0);
assert.deepEqual([reverseStop.frame, reverseStop.advance(.125), reverseStop.advance(.125), reverseStop.advance(.125)], [2, 1, 0, 0]);
let calls = 0;
const random = new EffectFrameClock({frameCount: 5, frameInterval: .125, frameFlags: 6}, (count) => {
  assert.equal(count, 5);
  ++calls;
  return 1;
});
assert.equal(random.frame, 4); // reverse initialization wins even with random bit
assert.equal(calls, 0);
assert.equal(random.advance(.0625), 4);
assert.equal(calls, 0);
assert.equal(random.advance(.0625), 1); // random update wins over reverse
assert.equal(calls, 1);
random.reset();
assert.equal(random.frame, 4);
assert.equal(random.remainder, 0);

// Actual source controllers: all finite frame parameters, valid forward/reverse paths.
assert.equal(library.spriteControls.length, 1088);
for (const control of library.spriteControls) {
  const original = new EffectFrameClock(control, () => 0);
  assert.equal(original.frame, control.frameFlags & 2 ? control.frameCount - 1 : 0);
  for (let step = 0; step < 20; ++step) {
    const frame = original.advance(control.frameInterval);
    assert.ok(frame >= 0 && frame < control.frameCount);
  }
}
assert.throws(() => clock.advance(-1));
assert.throws(() => clock.advance(NaN));
console.log('PASS: original explosion boundaries, one step per update, forward/reverse/clamp/loop/random precedence, 1088 source controllers');
