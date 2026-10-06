import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {LocalDeathCountdown} from '../apps/web/src/match/local-death-countdown';

// Timer contracts only; actual natural death and original glyph drawing require
// browser evidence, independently of this deterministic scheduler check.
mock.timers.enable({apis: ['setTimeout']});
try {
  const values: (number | undefined)[] = [];
  const countdown = new LocalDeathCountdown(value => values.push(value));
  countdown.update('room:1:local', true, false);
  values.length = 0;
  mock.timers.tick(999);
  assert.deepEqual(values, []);
  mock.timers.tick(1);
  assert.deepEqual(values, [5]);
  countdown.update('room:1:local', true, false);
  mock.timers.tick(1000);
  assert.deepEqual(values, [5, 4], 'dead snapshots must not restart the timer');
  for (let step = 0; step < 4; step++) mock.timers.tick(1000);
  assert.deepEqual(values, [5, 4, 3, 2, 1], 'zero preserves the displayed one');
  countdown.update('room:1:local', true, true);
  assert.equal(values.at(-1), undefined);
  countdown.update('room:1:local', true, false);
  mock.timers.tick(500);
  countdown.update('room:2:local', true, true);
  const cancelled = values.length;
  mock.timers.tick(2000);
  assert.equal(values.length, cancelled, 'round change cancels a pending callback');
  for (const endpoint of ['revive', 'leave', 'missing', 'clear']) {
    countdown.update('room:2:local', true, false);
    mock.timers.tick(1000);
    assert.equal(values.at(-1), 5);
    if (endpoint === 'clear') countdown.clear();
    else countdown.update('room:2:local', endpoint !== 'leave',
      endpoint === 'revive' ? true : endpoint === 'missing' ? undefined : false);
    assert.equal(values.at(-1), undefined);
    const before = values.length;
    mock.timers.tick(2000);
    assert.equal(values.length, before, `${endpoint} cancels the client timer`);
  }
  console.log('PASS local countdown delay, positive-only display, repeated snapshots, revive/round/leave/missing/clear cancellation');
} finally {
  mock.timers.reset();
}
