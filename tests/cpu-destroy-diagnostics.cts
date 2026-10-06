import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {BotController} from '../apps/server/src/battle/cpu/controller';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {segmentBox, type Point} from '../apps/server/src/battlefield';

// Observe the real controller and world; do not inject inputs or mutate state.
const mapId = Number(process.argv[2] ?? 20);
const cpuCount = Number(process.argv[3] ?? 3);
let now = 100000;
const world = new World(() => now);
const joined = world.createAndJoin('destroy-diagnostics', 5, mapId, 'CPU diagnostics', 'Observer', 1);
for (let index = 0; index < cpuCount; index++) {
  world.manageCpu(joined.playerId, 1, 'ADD', index % 3 === 1 ? 105 : 1);
}
world.ready(joined.playerId, 1);
const rows: unknown[] = [];
const original = BotController.prototype.input;
BotController.prototype.input = function(...args: Parameters<typeof original>) {
  const [actor, , objectives, field] = args;
  const input = original.apply(this, args);
  if (now % 5000 === 0) {
    const state = this as unknown as {targetId?: string; goal?: Point; path: Point[];
      planner?: unknown; failedApproaches: Map<string, number>; unavailableUntil: Map<string, number>};
    const objective = objectives.find(objective => objective.id === state.targetId);
    const source = objective && getSceneBreakables(mapId).find(source => source.id === objective.sourcePlacementId);
    const bearing = objective ? Math.atan2(objective.x - actor.x, objective.z - actor.z) : 0;
    const start = {x: actor.x + Math.sin(bearing) * 30, y: actor.y + 20, z: actor.z + Math.cos(bearing) * 30};
    const end = {x: start.x + Math.sin(bearing) * 792, y: start.y, z: start.z + Math.cos(bearing) * 792};
    rows.push({now, actor: {id: actor.id, x: actor.x, y: actor.y, z: actor.z, yaw: actor.yaw, aim: actor.aim}, input, target: objective ? {...objective} : undefined, goal: state.goal,
      pathLength: state.path.length, planning: Boolean(state.planner), failures: Object.fromEntries(state.failedApproaches),
      path: state.path.map(point => ({...point})), deferred: Object.fromEntries(state.unavailableUntil),
      targetRayHit: source ? segmentBox(start, end, source, 1) : undefined,
      wallRayHit: field.firstSurfaceHit(start, end, 1)?.fraction});
  }
  return input;
};
try {
  while (world.snapshot(joined.roomId)!.phase === 'PLAYING') {now += 50; world.step(50);}
  const final = world.snapshot(joined.roomId)!;
  writeFileSync(`recovery/output/cpu-destroy-diagnostics-${mapId}${cpuCount === 3 ? '' : `-cpu${cpuCount}`}.json`,
    JSON.stringify({mapId, cpuCount, rows, final}, null, 2));
  console.log(JSON.stringify(rows.slice(-6), null, 2));
} finally {BotController.prototype.input = original; world.leave(joined.playerId);}
