import type {SceneCrushSnapshot} from '../../../shared/protocols';
import {querySceneCrush} from './scene-crush';
import {segmentSphere, type Battlefield, type Point} from '../battlefield';
import {createRoleFreeAim} from './roles/free-aim';
import {selectShotTarget, type ShotTarget} from './roles/shot-target';

export interface ShotQueryOptions {
  /** Read the ordinary XZ half-width-25 strip instead of sphere intersection. */
  closestPlayer?: boolean;
  /** Total forward query range; the ordinary source distance is1000. */
  range?: number;
  /** FuncType22 skips static, scene and crush obstruction for target selection. */
  ignoreObstruction?: boolean;
}

/** Ordinary4354d7 uses an XZ strip; scene intersection still uses the Web battlefield. */
export function queryShotTarget(player: Point & {id: string}, look: Point,
  players: ReadonlyMap<string, Point & {id: string; alive: boolean}>,
  battlefield: Battlefield, bodyRadius: number, crushes: readonly SceneCrushSnapshot[] = [],
  ordinary = false, options?: ShotQueryOptions): ShotTarget {
  const closestPlayer = ordinary || options?.closestPlayer === true;
  const range = options?.range ?? 1000;
  const rangeScale = Math.fround(range * 0.001);
  const queryLook = range === 1000 ? look : {x: Math.fround(look.x * rangeScale),
    y: Math.fround(look.y * rangeScale), z: Math.fround(look.z * rangeScale)};
  const free = createRoleFreeAim(player, queryLook, 0);
  const start = {...player, y: closestPlayer ? 25 : player.y + 20};
  const end = {...free, y: closestPlayer ? 25 : free.y + 20};
  let surface = battlefield.firstSurfaceHit(start, end, 1);
  const crush = crushes.length ? querySceneCrush(start, end, crushes) : undefined;
  if (crush && (!surface || crush.fraction < surface.fraction)) {
    surface = {boxId: crush.id, fraction: crush.fraction};
  }
  let selected: {id: string; position: Point} | undefined;
  let nearest = Infinity;
  for (const target of players.values()) {
    if (!target.alive || target.id === player.id) continue;
    let distance: number | undefined;
    if (closestPlayer) {
      const x = Math.fround(Math.fround(target.x) - Math.fround(player.x));
      const z = Math.fround(Math.fround(target.z) - Math.fround(player.z));
      const forward = Math.fround(x * look.x + z * look.z);
      const lateral = Math.fround(x * look.z - z * look.x);
      // Original435a50 initializes half-width25;4354d7 includes both ends.
      if (forward >= 0 && forward <= range && Math.abs(lateral) <= 25) distance = forward;
    } else {
      distance = segmentSphere(start, end, {...target, y: target.y + bodyRadius}, bodyRadius);
    }
    if (distance !== undefined && distance < nearest) {
      nearest = distance;
      selected = {id: target.id, position: target};
    }
  }
  const scene = surface && !(options?.ignoreObstruction && selected) ? {id: surface.boxId,
    distance: surface.fraction * Math.hypot(free.x - player.x, free.y - player.y, free.z - player.z)} : undefined;
  return selectShotTarget(player, look, selected, scene, range);
}
