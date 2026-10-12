import type {MsgRoomEvent} from '../../../shared/protocols';
import type {Point} from '../battlefield';

/** Classify only the transactions produced by this accepted projectile contact. */
export function shotCausedDamage(events: readonly MsgRoomEvent[], firstEvent: number,
  ownerId: string, targetId: string): boolean {
  return events.slice(firstEvent).some(notice => notice.playerId === ownerId && notice.targetId === targetId
    && (notice.type === 'sceneCrushed' || notice.value > 0
      && ['hit', 'sceneObjectHit', 'objectiveHit'].includes(notice.type)));
}

/** One contact cue, independent of damage notifications and periodic skills. */
export function shotImpactEvent(roomId: string, ownerId: string, targetId: string,
  point: Point, damaging: boolean, itemId: number | undefined, scene: boolean): MsgRoomEvent {
  return {roomId, type: 'shotImpact', message: '', playerId: ownerId, targetId,
    value: damaging ? 1 : 0, ...point, skillId: itemId,
    shotDisplay: damaging && scene && itemId !== undefined ? {itemId, ...point} : undefined};
}
