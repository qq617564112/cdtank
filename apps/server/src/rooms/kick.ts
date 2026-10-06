import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {World} from '../world';
import type {roomTransport} from './transport';
import type {RoomReconnections} from './reconnection';

export function registerRoomKickApi(server: WsServer<ServiceType>, world: World,
  sessions: Map<string, {roomId: string; playerId: string}>,
  transport: ReturnType<typeof roomTransport>, reconnections: RoomReconnections): void {
  server.implementApi('KickRoomPlayer', async call => {
    const session = sessions.get(call.conn.id);
    if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
    let removed: ReturnType<World['kickRoomPlayer']>;
    try {
      removed = world.kickRoomPlayer(session.playerId, call.req.round, call.req.playerId);
    } catch (error) {
      return call.error(error instanceof Error ? error.message : '踢出失败', {code: 'ROOM_KICK_REJECTED'});
    }
    const targetConnections = server.connections.filter(connection =>
      sessions.get(connection.id)?.playerId === call.req.playerId);
    for (const [connectionId, value] of sessions) {
      if (value.playerId === call.req.playerId) sessions.delete(connectionId);
    }
    reconnections.releasePlayer(call.req.playerId);
    await server.broadcastMsg('RoomEvent', {roomId: removed.roomId, type: 'kicked',
      message: '你已被房主踢出房间', playerId: session.playerId, targetId: call.req.playerId,
      value: 0, x: 0, y: 0, z: 0}, targetConnections)
      .catch((error: unknown) => console.error('Room kick notification failed', error));
    await call.succ({round: call.req.round, playerId: call.req.playerId});
    for (const event of removed.events) transport.broadcastEvent(event);
    transport.broadcastRoomState(removed.roomId);
  });
}
