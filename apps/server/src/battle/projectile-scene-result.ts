import {gameContent} from '../../../shared/content/catalog';
import type {MsgRoomEvent} from '../../../shared/protocols';

/** Frozen supported ammo presents only its accepted lethal scene transaction. */
export function attachProjectileSceneResult(events: MsgRoomEvent[], firstEvent: number,
  ownerId: string, ammoItemId: number | undefined): void {
  if (ammoItemId === undefined || !gameContent().items.get(ammoItemId)?.runtime.sceneResult) return;
  for (let index = firstEvent; index < events.length; index++) {
    const result = events[index];
    if (result.playerId !== ownerId
        || (result.type !== 'sceneObjectDestroyed' && result.type !== 'objectiveDestroyed')) continue;
    result.shotItemResult = {itemId: ammoItemId, x: result.x, y: result.y, z: result.z};
  }
}
