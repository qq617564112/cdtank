import type {MsgPlayerInput} from '../../../shared/protocols';
import {tankTurretYaw} from '../../../shared/combat/tank-turret';
import {content} from '../content';
import {segmentBox, type Battlefield, type Point} from '../battlefield';
import {getSceneCastles, type SceneBreakable} from '../scene-objects';
import {createOriginalBotNavigation} from '../battle/cpu/original-navigation';
import {BotPathPlanner} from '../battle/cpu/navigation';
import {healingHotkey} from '../battle/cpu/items';
import {createBattleMovementPredictor} from '../battle/dynamic-movement';
import {originalMovementParameters} from '../battle/movement';
import {roleMovementElapsed} from '../battle/roles/movement-time';
import type {PlayerState} from '../battle/player-state';
import type {RoomState} from '../rooms/state';
import {LearningCombatExpert} from './expert';

interface Route {
  target: string;
  deaths: number;
  candidates: Point[];
  path: Point[];
  planner?: BotPathPlanner;
}

function angle(value: number): number {return Math.atan2(Math.sin(value), Math.cos(value));}

function firingLine(field: Battlefield, position: Point, heading: number,
  source: SceneBreakable, range: number): boolean {
  const origin = {x: position.x + Math.sin(heading) * 30, y: position.y + 20,
    z: position.z + Math.cos(heading) * 30};
  const end = {x: origin.x + Math.sin(heading) * range, y: origin.y,
    z: origin.z + Math.cos(heading) * range};
  const hit = segmentBox(origin, end, source, 1);
  const wall = field.firstSurfaceHit(origin, end, 1);
  return hit !== undefined && (!wall || wall.fraction >= hit || field.isPlacementHit(wall.boxId, source.id))
    && !field.firstSurfaceHit({...position, y: origin.y}, origin, 1);
}

/** Offline route labels use source NAV; the student retains its ordinary local observation. */
export class LearningSiegeExpert extends LearningCombatExpert {
  private readonly routes = new WeakMap<PlayerState, Route>();

  override input(room: RoomState, player: PlayerState, maximumHp: number, now: number): MsgPlayerInput {
    const input: MsgPlayerInput = {sequence: 0, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: now};
    const parameters = originalMovementParameters(player);
    if (!player.alive || !parameters) return input;
    input.useItem = healingHotkey({...player, maxHp: maximumHp});
    const target = room.objectives.find(object => object.hp > 0 && object.ownerTeam >= 0
      && object.ownerTeam !== player.team);
    const source = target && getSceneCastles(room.map.mapId).find(object => object.id === target.sourcePlacementId);
    if (!target || !source) return input;
    const field = room.battlefield;
    const range = content.items.get(player.combat.currentAmmoTableId)!.runtime.range!
      * (player.shotModifiers?.rangePercent ?? 100) / 100;
    const bearing = Math.atan2(target.x - player.x, target.z - player.z);
    let route = this.routes.get(player);
    if (!route || route.target !== target.id || route.deaths !== player.deaths) {
      const candidates: Point[] = [];
      for (const radius of [.65 * range, .8 * range]) {
        for (let step = 0; step < 24; step++) {
          const direction = step * Math.PI / 12;
          const x = target.x + Math.sin(direction) * radius;
          const z = target.z + Math.cos(direction) * radius;
          const y = field.navigation.validHeightAt(x, z);
          if (y === undefined) continue;
          const candidate = {x, y, z};
          if (firingLine(field, candidate, Math.atan2(target.x - x, target.z - z), source, range)) {
            candidates.push(candidate);
          }
        }
      }
      candidates.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z)
        - Math.hypot(b.x - player.x, b.z - player.z));
      route = {target: target.id, deaths: player.deaths, candidates, path: []};
      this.routes.set(player, route);
    }
    const navigation = createOriginalBotNavigation(field);
    const predict = createBattleMovementPredictor(player, field, room.players.values(), .1);
    if (Math.hypot(target.x - player.x, target.z - player.z) > .82 * range
        || !firingLine(field, player, bearing, source, range)) {
      if (!route.path.length && !route.planner && route.candidates.length) {
        route.planner = new BotPathPlanner(field, player, route.candidates.shift()!, navigation);
      }
      if (route.planner) {
        const path = route.planner.advance(2048, 8);
        if (path !== undefined) {route.path = path; route.planner = undefined;}
      }
      while (route.path.length && Math.hypot(route.path[0].x - player.x, route.path[0].z - player.z) < 18
          && (!route.path[1] || navigation.canTraverse(player, route.path[1]))) route.path.shift();
      const waypoint = route.path[0];
      if (waypoint) {
        const distance = Math.hypot(waypoint.x - player.x, waypoint.z - player.z);
        const error = Math.abs(angle(Math.atan2(waypoint.x - player.x, waypoint.z - player.z) - player.yaw));
        let best = 0;
        for (const move of [-1, 0, 1]) {
          for (const turn of [-1, 0, 1]) {
            const point = predict({...input, move, turn});
            const after = Math.hypot(waypoint.x - point.x, waypoint.z - point.z);
            const heading = Math.abs(angle(Math.atan2(waypoint.x - point.x, waypoint.z - point.z) - point.yaw));
            const score = distance - after + 30 * (error - heading);
            if (score > best) {best = score; input.move = move; input.turn = turn;}
          }
        }
      }
    }
    const point = predict(input);
    const nextBearing = Math.atan2(target.x - point.x, target.z - point.z);
    const turret = tankTurretYaw(player.tank.id, {...point, aim: player.aim});
    const error = angle(nextBearing - turret);
    input.aim = Math.abs(error) > .04 ? Math.sign(error) : 0;
    const shotHeading = turret + input.aim * parameters.turn * roleMovementElapsed(.1);
    input.fire = Math.abs(angle(nextBearing - shotHeading)) < .07
      && firingLine(field, point, shotHeading, source, range);
    return input;
  }
}
