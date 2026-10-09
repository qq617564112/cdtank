import type {MsgCall, WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {MsgPlayerInput, MsgPlayerAction} from '../../../shared/protocols';
import type {WorldEvent} from '../world';
import type {RoomWorld as World} from '../rooms/world-interface';

/** Route ordinary inputs to their authenticated participant; World decides effects. */
export function registerBattleInputs(server: WsServer<ServiceType>, world: World,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>,
  broadcastEvent: (event: WorldEvent) => void,
  broadcastRoomSnapshot: (roomId: string) => void): void {
  server.listenMsg('PlayerInput', async (call: MsgCall<MsgPlayerInput>) => {
    const session = sessions.get(call.conn.id);
    if (!session) {
      return;
    }
    const events = await world.updateInput(session.playerId, call.msg);
    if (events.some(event => event.roleStyleChanged || event.roleStyleRestored)) {
      broadcastRoomSnapshot(session.roomId);
    }
    for (const event of events) {
      broadcastEvent(event);
    }
  });

  server.listenMsg('PlayerAction', async (call: MsgCall<MsgPlayerAction>) => {
    const session = sessions.get(call.conn.id);
    if (!session) {
      return;
    }
    const snapshot = world.snapshot(session.roomId);
    if (call.msg.roomId !== session.roomId || !snapshot || call.msg.round !== snapshot.match?.round) {
      return;
    }
    const result = await world.useAction(session.playerId, call.msg);
    if (!result) return;
    const affectedRooms = new Set(result.affectedRoomIds);
    if (affectedRooms.size) {
      for (const roomId of affectedRooms) broadcastRoomSnapshot(roomId);
    }
    for (const event of result.events) {
      broadcastEvent(event);
    }
  });
}
