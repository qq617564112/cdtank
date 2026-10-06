import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {World} from '../world';
import type {roomTransport} from './transport';

/** Explicit departure uses the same lifecycle as disconnect, preserving account authentication. */
export function registerRoomLeaveApi(server: WsServer<ServiceType>, world: World,
  sessions: Map<string, {roomId: string; playerId: string}>,
  transport: ReturnType<typeof roomTransport>): void {
  let departures: Promise<void> = Promise.resolve();
  server.implementApi('Leave', async call => {
    const departure = departures.then(async () => {
      // Let battle timers run between synchronous settlement commits from different rooms.
      await new Promise<void>(resolve => setImmediate(resolve));
      const session = sessions.get(call.conn.id);
      if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
      const snapshot = world.snapshot(session.roomId);
      if (call.req.roomId !== session.roomId || call.req.round !== snapshot?.match?.round
          || !snapshot.players.some(player => player.id === session.playerId)) {
        return call.error('房间或局号已变化，请刷新后重试', {code: 'LEAVE_CONFLICT'});
      }
      const events = world.leave(session.playerId);
      sessions.delete(call.conn.id);
      await call.succ({roomId: session.roomId, round: call.req.round});
      for (const event of events) transport.broadcastEvent(event);
      transport.broadcastRoomState(session.roomId);
    });
    departures = departure.then(() => undefined, () => undefined);
    await departure;
  });
}
