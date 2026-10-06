import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {World} from '../dist/server/server/src/world.js';

const steps = [];
const step = World.prototype.step;
World.prototype.step = function(deltaMs) {
  const started = performance.now();
  const result = step.call(this, deltaMs);
  steps.push({wallAt: Date.now(), at: started, duration: performance.now() - started, rooms: result.snapshots.length});
  return result;
};
process.once('SIGTERM', () => {
  writeFileSync(process.env.CDTANK_TICK_PROFILE_STEPS, JSON.stringify({steps, memory: process.memoryUsage()}));
  process.exit(0);
});
await import('../dist/server/server/src/index.js');
