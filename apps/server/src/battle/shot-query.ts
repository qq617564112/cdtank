import type {SceneCrushSnapshot} from '../../../shared/protocols';
import {querySceneCrush} from './scene-crush';
import {segmentSphere, type Battlefield, type Point} from '../battlefield';
import {createRoleFreeAim} from './roles/free-aim';
import {selectShotTarget, type ShotTarget} from './roles/shot-target';

/** Existing Web collision geometry supplies queries; original436078/436fe0 kernels remain unrecovered. */
export function queryShotTarget(player: Point & {id: string}, look: Point,
  players: ReadonlyMap<string, Point & {id: string; alive: boolean}>,
  battlefield: Battlefield, bodyRadius: number, crushes: readonly SceneCrushSnapshot[] = []): ShotTarget {
  const free = createRoleFreeAim(player, look, 0);
  // Preserve the existing rebuilt projectile height/radius for the query provider.
  const start = {...player, y: player.y + 20};
  const end = {...free, y: free.y + 20};
  let surface = battlefield.firstSurfaceHit(start, end, 1);
  const crush = crushes.length ? querySceneCrush(start, end, crushes) : undefined;
  if (crush && (!surface || crush.fraction < surface.fraction)) {
    surface = {boxId: crush.id, fraction: crush.fraction};
  }
  let selected: {id: string; position: Point} | undefined;
  let nearest = Infinity;
  for (const target of players.values()) {
    if (!target.alive || target.id === player.id) continue;
    const fraction = segmentSphere(start, end, {...target, y: target.y + bodyRadius}, bodyRadius);
    if (fraction !== undefined && fraction < nearest) {
      nearest = fraction;
      selected = {id: target.id, position: target};
    }
  }
  return selectShotTarget(player, look, selected, surface ? {id: surface.boxId,
    distance: surface.fraction * Math.hypot(free.x - player.x, free.y - player.y, free.z - player.z)} : undefined);
}
