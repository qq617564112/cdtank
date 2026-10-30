import type {ObjectiveSnapshot, SceneObjectSnapshot} from '../../../../shared/protocols';
import {segmentBox, type Battlefield, type Point} from '../../battlefield';
import type {NavigationGrid} from '../../navigation';
import {getSceneBreakables, type SceneBreakable} from '../../scene-objects';
import {queryShotTarget} from '../shot-query';
import type {BotActor} from './controller';
import {BotPathPlanner} from './navigation';
import {createOriginalBotNavigation} from './original-navigation';
import {ARRIVAL_RADIUS} from './driving';

type BreakableSnapshot = SceneObjectSnapshot | ObjectiveSnapshot;

export interface BotBreach {
  readonly object: BreakableSnapshot;
  readonly source: SceneBreakable;
  readonly aim: Point;
  readonly path: Point[];
}

const planningGrids = new WeakMap<Battlefield, {revision: number; grid: NavigationGrid}>();

/** Find the first removable obstruction on a route without opening the live NAV. */
export class BotBreachPlanner {
  private planner?: BotPathPlanner;
  private requestedGoal?: Point;
  private pursuitId?: string;
  private revision = -1;
  private startedAt = 0;
  private nextSearchAt = 0;
  private nextLocalSearchAt = 0;
  private breach?: BotBreach;
  private localSelections = 0;

  get waypoint(): Point | undefined {
    return this.breach && this.breach.object.hp > 0 ? this.breach.path[0] : undefined;
  }

  get working(): boolean {return !!(this.planner || this.requestedGoal || this.breach);}

  get searching(): boolean {return this.planner !== undefined;}
  get localSelectionCount(): number {return this.localSelections;}

  request(goal: Point): void {
    if (!this.planner && !this.breach) this.requestedGoal ??= {...goal};
  }

  retry(goal: Point): void {
    this.planner = undefined;
    this.breach = undefined;
    this.requestedGoal = {...goal};
    this.nextSearchAt = 0;
  }

  reset(): void {
    this.planner = undefined;
    this.requestedGoal = undefined;
    this.breach = undefined;
    this.pursuitId = undefined;
    this.nextSearchAt = 0;
  }

  advance(actor: BotActor, pursuit: (Point & {id: string}) | undefined,
    objects: readonly BreakableSnapshot[], field: Battlefield, now: number,
    stalledSeconds = 0): BotBreach | undefined {
    const pursuitId = pursuit?.id;
    if (this.pursuitId !== pursuitId || this.revision !== field.navigationRevision) {
      this.reset();
      this.pursuitId = pursuitId;
      this.revision = field.navigationRevision;
    }
    if (!pursuit) return undefined;
    if (stalledSeconds >= 6 && now >= this.nextLocalSearchAt && actor.movement
        && (!this.breach || this.breach.path.length > 0)) {
      this.nextLocalSearchAt = now + 2500;
      const trapped = [-1, 1].every(move => [-1, 0, 1].every(turn => {
        const next = actor.movement!.predict({sequence: 0, clientTime: now,
          move, turn, aim: 0, fire: false, useItem: 0});
        return horizontalDistance(actor, next) <= .01;
      }));
      if (trapped) {
        const local = localBreach(actor, objects, field);
        if (local) {
          this.localSelections++;
          this.breach = local;
          this.planner = undefined;
          this.requestedGoal = undefined;
        }
      }
    }
    if (this.breach) {
      const object = objects.find(other => other.id === this.breach!.object.id);
      if (!object) {this.breach = undefined; return undefined;}
      if (object.hp <= 0 && !field.navigation.hasBlocker(object.id)
          && !field.navigation.hasBlocker(`SCN:${object.sourcePlacementId}`)) {
        this.reset();
        return undefined;
      }
      // Broken geometry remains authoritative during its ordinary fade. Replan
      // when collision release changes the field revision, rather than ramming it.
      this.breach = {...this.breach, object};
      while (this.breach.path.length && horizontalDistance(actor, this.breach.path[0]) < ARRIVAL_RADIUS) {
        const next = this.breach.path[1];
        if (next) {
          const reached = actor.movement
            ? actor.movement.navigation.reachable(actor, next) : field.move(actor, next, 20);
          if (horizontalDistance(reached, next) >= .01) break;
        }
        this.breach.path.shift();
      }
      if (!this.breach.path.length && object.hp > 0) {
        const aim = firingPoint(actor, this.breach.aim, this.breach.source, field);
        if (!aim) {this.retry(pursuit); return undefined;}
        this.breach = {...this.breach, aim};
      }
      return this.breach;
    }
    if (!this.planner && this.requestedGoal && now >= this.nextSearchAt) {
      const ids = new Set(objects.filter(object => !object.id.startsWith('CASTLE:'))
        .flatMap(object => [object.id, `SCN:${object.sourcePlacementId}`]));
      if (!ids.size) {this.requestedGoal = undefined; return undefined;}
      let cached = planningGrids.get(field);
      if (!cached || cached.revision !== field.navigationRevision) {
        cached = {revision: field.navigationRevision, grid: field.navigation.withoutBlockers(ids)};
        planningGrids.set(field, cached);
      }
      this.planner = new BotPathPlanner(field, actor, this.requestedGoal,
        createOriginalBotNavigation({navigation: cached.grid}), cached.grid);
      this.requestedGoal = undefined;
      this.startedAt = now;
    }
    if (!this.planner) return undefined;
    const path = this.planner.advance(128, 1);
    if (path === undefined && now - this.startedAt < 8000) return undefined;
    this.planner = undefined;
    this.nextSearchAt = now + 2500;
    if (path?.length) this.breach = firstBreach(actor, path, objects, field);
    return this.breach;
  }
}

function localBreach(actor: BotActor, objects: readonly BreakableSnapshot[],
  field: Battlefield): BotBreach | undefined {
  const sources = getSceneBreakables(Number(field.source.id));
  const contact = {...actor, y: actor.y + 20};
  const candidates = objects.flatMap(object => {
    if (object.hp <= 0 || object.id.startsWith('CASTLE:')
        || !field.navigation.hasBlocker(object.id)
          && !field.navigation.hasBlocker(`SCN:${object.sourcePlacementId}`)) return [];
    const source = sources.find(value => value.id === object.sourcePlacementId);
    return source && segmentBox(contact, contact, source, 60) !== undefined ? [{object, source}] : [];
  }).sort((a, b) => horizontalDistance(actor, a.object) - horizontalDistance(actor, b.object));
  for (const {object, source} of candidates) {
    const aim = firingPoint(actor, object, source, field);
    if (aim) return {object, source, aim, path: []};
  }
  return undefined;
}

function firstBreach(actor: BotActor, path: readonly Point[],
  objects: readonly BreakableSnapshot[], field: Battlefield): BotBreach | undefined {
  const sources = getSceneBreakables(Number(field.source.id));
  const candidates = objects.flatMap(object => {
    if (!field.navigation.hasBlocker(object.id)
        && !field.navigation.hasBlocker(`SCN:${object.sourcePlacementId}`)) return [];
    const source = sources.find(source => source.id === object.sourcePlacementId);
    return source ? [{object, source}] : [];
  });
  const reach = (start: Point, end: Point) => actor.movement
    ? actor.movement.navigation.reachable(start, end) : field.move(start, end, 20);
  const prefix: Point[] = [];
  let start: Point = actor;
  for (const end of path) {
    const reached = reach(start, end);
    if (horizontalDistance(reached, end) < .01) {
      prefix.push(end);
      start = end;
      continue;
    }
    const origin = {...start, y: start.y + 20};
    const destination = {...end, y: end.y + 20};
    // Include the 49x52 body, occupied 12-unit cells and the six-unit NAV step.
    const contact = {...reached, y: reached.y + 20};
    const hits = candidates.flatMap(candidate => {
      if (segmentBox(contact, contact, candidate.source, 60) === undefined) return [];
      const fraction = segmentBox(origin, destination, candidate.source, 60);
      return fraction === undefined ? [] : [{...candidate, fraction}];
    }).sort((a, b) => a.fraction - b.fraction);
    // Keep the firing position on this last straight segment so backing away
    // cannot put an earlier corner between the muzzle and the obstruction.
    const length = horizontalDistance(start, reached);
    if (length > 96) {
      const fraction = (length - 96) / length;
      const x = start.x + (reached.x - start.x) * fraction;
      const z = start.z + (reached.z - start.z) * fraction;
      prefix.push({x, z, y: field.navigation.sample(x, z)!.height});
    }
    const position = prefix[prefix.length - 1] ?? actor;
    for (const hit of hits) {
      const fraction = segmentBox(origin, destination, hit.source, 1);
      const preferredAim = fraction === undefined ? hit.object : {
        x: start.x + (end.x - start.x) * fraction,
        y: hit.object.y,
        z: start.z + (end.z - start.z) * fraction,
      };
      const aim = firingPoint(position, preferredAim, hit.source, field);
      if (aim) return {object: hit.object, source: hit.source, aim, path: prefix};
    }
    return undefined;
  }
  return undefined;
}

/** Aim at a real face at ordinary shot height, including open slats in fences. */
function firingPoint(position: Point, preferred: Point, source: SceneBreakable,
  field: Battlefield): Point | undefined {
  const points: Point[] = [preferred, {x: source.matrix[12], y: 25, z: source.matrix[14]}];
  for (const {vertices} of source.mesh?.triangles ?? []) {
    const crossings: Point[] = [];
    for (let index = 0; index < 3; index++) {
      const a = vertices[index], b = vertices[(index + 1) % 3];
      if (a[1] === b[1] || (a[1] < 25 && b[1] < 25) || (a[1] > 25 && b[1] > 25)) continue;
      const fraction = (25 - a[1]) / (b[1] - a[1]);
      crossings.push({x: a[0] + (b[0] - a[0]) * fraction, y: 25,
        z: a[2] + (b[2] - a[2]) * fraction});
    }
    if (crossings.length >= 2) points.push({x: (crossings[0].x + crossings[1].x) / 2,
      y: 25, z: (crossings[0].z + crossings[1].z) / 2});
  }
  points.sort((a, b) => horizontalDistance(a, preferred) - horizontalDistance(b, preferred));
  return points.find(point => {
    const bearing = Math.atan2(point.x - position.x, point.z - position.z);
    const shot = queryShotTarget({...position, id: ''},
      {x: Math.sin(bearing), y: 0, z: Math.cos(bearing)}, new Map(), field, 20, undefined, true);
    return shot.kind === 'SCENE' && field.isPlacementHit(shot.targetId, source.id);
  });
}

function horizontalDistance(a: Point, b: Point): number {return Math.hypot(a.x - b.x, a.z - b.z);}
