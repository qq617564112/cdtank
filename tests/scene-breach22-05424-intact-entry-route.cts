import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import type {RoomState} from '../apps/server/src/rooms/state';
import {BotPathPlanner} from '../apps/server/src/battle/cpu/navigation';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';

const world = new World();
const joined = world.createAndJoin('breach22-05424-route', 5, 22, 'B22', 'Player', 1);
try {
  for (let i = 0; i < 3; i++) {
    world.manageCpu(joined.playerId, 1, 'ADD', 1);
  }
  world.ready(joined.playerId, 1);
  const room = (world as unknown as {rooms: Map<string, RoomState>}).rooms.get(joined.roomId)!;
  const player = world.snapshot(joined.roomId)!.players.find(p => p.id === joined.playerId)!;
  const start = {x: player.x, y: player.y, z: player.z};
  const goal = {x: -910, y: 0, z: 820};
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
    mapId: '0022', model: 'obj05424', sourceId: '527', start, goal,
    navValid: Boolean(cell?.valid), route: route ?? [],
    scope: 'Original NAV entry preparation only; no active pose injection, production registration, player pixels or Leave acceptance.',
  };
  writeFileSync('recovery/output/scene-breach22-05424-intact-entry-route.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  world.leave(joined.playerId);
}
