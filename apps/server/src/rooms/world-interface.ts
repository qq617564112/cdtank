import type {World} from '../world';

/** Directory reads use published state; authoritative operations run in the room. */
export type RoomCommand =
  | 'createAndJoin' | 'joinRoom' | 'manageCpu' | 'configureAutopilot'
  | 'ready' | 'resourcesLoaded' | 'changeTeam' | 'kickRoomPlayer' | 'editRoom'
  | 'rematch' | 'leave' | 'exitPenaltyCount' | 'pauseDisconnectedPlayer'
  | 'restorePlayerConnection' | 'playerInputSequence' | 'bindInventory'
  | 'bindRoleSources' | 'bindEquipmentProfile' | 'bindTitle' | 'refreshAccountTitle'
  | 'inventory' | 'selectTank' | 'canConfigureInventory' | 'confirmKitbag'
  | 'updateInput' | 'useAction' | 'chat' | 'publishReceipts'
  | 'publishInventoryGrants' | 'synchronizeInventoryRecord';

type RoomOperations = {
  [K in RoomCommand]: (...args: Parameters<World[K]>) =>
    ReturnType<World[K]> | Promise<ReturnType<World[K]>>;
};

export type RoomWorld = RoomOperations & Pick<World,
  'listRooms' | 'listMaps' | 'snapshot' | 'roomName' | 'roomPlayers'> & {
    quickMatch(...args: Parameters<World['quickMatch']>):
      ReturnType<World['quickMatch']> | Promise<ReturnType<World['quickMatch']>>;
  };
