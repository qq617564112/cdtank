import type {MsgRoomEvent} from '../../../shared/protocols';

/** Frozen supported ammo presents only its accepted lethal scene transaction. */
export function attachProjectileSceneResult(events: MsgRoomEvent[], firstEvent: number,
  ownerId: string, ammoItemId: number | undefined): void {
  if (ammoItemId !== 2002 && ammoItemId !== 2003 && ammoItemId !== 2004 && ammoItemId !== 2005
      && ammoItemId !== 2006 && ammoItemId !== 2008 && ammoItemId !== 2011 && ammoItemId !== 2012
      && ammoItemId !== 2013 && ammoItemId !== 2014 && ammoItemId !== 2015
      && ammoItemId !== 2017 && ammoItemId !== 2018 && ammoItemId !== 2019
      && ammoItemId !== 2020 && ammoItemId !== 2021) return;
  for (let index = firstEvent; index < events.length; index++) {
    const result = events[index];
    if (result.playerId !== ownerId
        || (result.type !== 'sceneObjectDestroyed' && result.type !== 'objectiveDestroyed')) continue;
    result.shotItemResult = {itemId: ammoItemId, x: result.x, y: result.y, z: result.z};
  }
}
