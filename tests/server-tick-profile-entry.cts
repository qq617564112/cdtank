import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {World} from '../apps/server/src/world';

const steps: {at: number; duration: number; rooms: number}[] = [];
const original = World.prototype.step;
World.prototype.step = function(deltaMs) {
  const start = performance.now();
  const result = original.call(this, deltaMs);
  steps.push({at: start, duration: performance.now() - start, rooms: result.snapshots.length});
  return result;
};
process.once('SIGTERM', () => {
  writeFileSync(process.env.CDTANK_TICK_PROFILE_STEPS!, JSON.stringify({steps, memory: process.memoryUsage()}));
  process.exit(0);
});
void import('../apps/server/src/index.js');
