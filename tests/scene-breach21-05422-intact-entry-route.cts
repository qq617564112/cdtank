import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {RoomState} from '../apps/server/src/rooms/state';
import {BotPathPlanner} from '../apps/server/src/battle/cpu/navigation';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';

const world = new World();
const joined = world.createAndJoin('breach21-05422-route', 5, 21, 'B21', 'Player', 1);
try {
  for (let i = 0; i < 3; i++) {
    world.manageCpu(joined.playerId, 1, 'ADD', 1);
  }
  world.ready(joined.playerId, 1);
  const room = (world as unknown as {rooms: Map<string, RoomState>}).rooms.get(joined.roomId)!;
  const player = world.snapshot(joined.roomId)!.players.find(p => p.id === joined.playerId)!;
  const start = {x: player.x, y: player.y, z: player.z};
  interface Placement {id: string; model: string; className: string; enabled: boolean; position: number[];}
  const scenes = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json', 'utf8')) as Array<{id: string; records: Placement[]}>;
  const records = scenes.find(s => s.id === '0021')!.records.filter(r =>
    r.className === 'SYcScnObjBreach' && r.model === 'obj05422' && r.enabled);
  const nearest = [...records].sort((a, b) =>
    Math.hypot(a.position[0] - start.x, a.position[2] - start.z) -
    Math.hypot(b.position[0] - start.x, b.position[2] - start.z)).slice(0, 2);
  const goal = {x: -290, y: 0, z: -1120};
  const cell = room.battlefield.navigation.sample(goal.x, goal.z);
  let route;
  if (cell?.valid) {
    goal.y = cell.height;
    const policy = createOriginalBotNavigation(room.battlefield, {width: 73, depth: 76});
    const planner = new BotPathPlanner(room.battlefield, start, goal, policy);
    for (let i = 0; i < 10000 && route === undefined; i++) {
      route = planner.advance(1000, 20);
    }
  }
  const result = {
    status: !cell?.valid ? 'INVALID_NAV_APPROACH' : route?.length ? 'PASS_SOURCE_NAV_PATH_ONLY' : 'NO_FOOTPRINT_PATH',
    mapId: '0021', model: 'obj05422', sourceId: nearest[0].id, start, goal,
    placementCount: records.length,
    candidates: nearest.map(r => ({sourceId: r.id, position: r.position,
      distanceFromSpawn: Math.hypot(r.position[0] - start.x, r.position[2] - start.z)})),
    navValid: Boolean(cell?.valid), route: route ?? [],
    scope: 'Formal World spawn selection and original NAV preparation only; no active position injection, production registration, player pixels or Leave acceptance.',
  };
  writeFileSync('recovery/output/scene-breach21-05422-intact-entry-route.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  world.leave(joined.playerId);
}
