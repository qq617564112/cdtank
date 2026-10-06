import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {Battlefield} from '../apps/server/src/battlefield';
import {BotController} from '../apps/server/src/battle/cpu/controller';
import {BotPathPlanner} from '../apps/server/src/battle/cpu/navigation';
import {NavigationGrid} from '../apps/server/src/navigation';

const mapId = Number(process.argv[2] ?? 4), ticks = Number(process.argv[3] ?? 600);
const label = process.argv[4] ?? 'current';
const costs = new Map<string, {count: number; totalMs: number; maxMs: number}>();
const restores: Array<() => void> = [];
function measure<T extends object>(prototype: T, name: keyof T, label: string): void {
  const original = prototype[name] as (...args: unknown[]) => unknown;
  const row = {count: 0, totalMs: 0, maxMs: 0}; costs.set(label, row);
  prototype[name] = function(this: T, ...args: unknown[]): unknown {
    const start = performance.now();
    try {return original.apply(this, args);} finally {
      const elapsed = performance.now() - start;
      row.count++; row.totalMs += elapsed; row.maxMs = Math.max(row.maxMs, elapsed);
    }
  } as T[keyof T];
  restores.push(() => {prototype[name] = original as T[keyof T];});
}
measure(Battlefield.prototype, 'firstBoxHit', 'boxCollision');
measure(Battlefield.prototype, 'firstSurfaceHit', 'surfaceCollision');
measure(Battlefield.prototype, 'move', 'movementSweep');
measure(NavigationGrid.prototype, 'firstInvalidFraction', 'navigationSweep');
measure(BotPathPlanner.prototype, 'advance', 'pathAdvance');
measure(BotController.prototype, 'input', 'cpuInput');
let now = 100000;
try {
  const world = new World(() => now);
  const joined = world.createAndJoin('cpu-query-profile', 1, mapId, 'CPU profile', 'Observer', 1);
  for (const tankId of [1, 105, 1]) world.manageCpu(joined.playerId, 1, 'ADD', tankId);
  world.ready(joined.playerId, 1);
  const initial = world.snapshot(joined.roomId)!;
  const steps: number[] = [];
  let fire = 0, hit = 0;
  const start = performance.now();
  for (let tick = 0; tick < ticks && world.snapshot(joined.roomId)!.phase === 'PLAYING'; tick++) {
    now += 50;
    const stepStart = performance.now();
    const result = world.step(50);
    steps.push(performance.now() - stepStart);
    fire += result.events.filter(event => event.type === 'fire').length;
    hit += result.events.filter(event => event.type === 'hit').length;
  }
  steps.sort((a, b) => a - b);
  const evidence = {scope: 'Instrumented ordinary-input CPU simulation, initial source spawns; nested timings overlap; simulated time and profiling overhead do not prove real-time latency.',
    mapId, ticks: steps.length, elapsedMs: performance.now() - start, fire, hit,
    steps: {p50Ms: steps[Math.floor(steps.length * .5)], p95Ms: steps[Math.floor(steps.length * .95)], maxMs: steps.at(-1)},
    costs: Object.fromEntries(costs), initial, final: world.snapshot(joined.roomId)};
  world.leave(joined.playerId);
  writeFileSync(`recovery/output/cpu-query-profile-${mapId}-${label}.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({mapId, elapsedMs: evidence.elapsedMs, steps: evidence.steps, costs: evidence.costs, fire, hit}));
} finally {for (const restore of restores) restore();}
