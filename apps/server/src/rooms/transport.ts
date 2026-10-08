import type {MsgCall, WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {MsgChat, MsgRoomSnapshot} from '../../../shared/protocols';
import type {World, WorldEvent} from '../world';
import type {RoomReconnections} from './reconnection';
import {registerRoomChatApi} from './chat';
import type {AccountStore} from '../account-store';

interface RoomSession {
  roomId: string;
  playerId: string;
}

/** Resolve recipients from current session membership for every broadcast. */
export function roomTransport(server: WsServer<ServiceType>, world: World,
  sessions: ReadonlyMap<string, RoomSession>) {
  const connections = (roomId: string) => server.connections.filter(connection =>
    sessions.get(connection.id)?.roomId === roomId);
  return {
    broadcastRoomState(roomId: string): void {
      const snapshot = world.snapshot(roomId);
      if (!snapshot) return;
      server.broadcastMsg('RoomState', {roomId, phase: snapshot.phase,
        players: snapshot.players.map(player => ({id: player.id, name: player.name})), message: ''},
        connections(roomId)).catch((error: unknown) => console.error('RoomState broadcast failed', error));
    },
    broadcastEvent(payload: WorldEvent): void {
      let recipients = connections(payload.roomId);
      if (payload.type === 'chat' && payload.value === 1) {
        const snapshot = world.snapshot(payload.roomId);
        const sender = snapshot?.players.find(player => player.id === payload.playerId);
        if (!snapshot || ![1, 2, 3].includes(snapshot.mode) || !sender
            || (sender.team !== 0 && sender.team !== 1)) return;
        const teammates = new Set(snapshot.players.filter(player => player.team === sender.team)
          .map(player => player.id));
        recipients = recipients.filter(connection => {
          const session = sessions.get(connection.id);
          return session !== undefined && teammates.has(session.playerId);
        });
      }
      server.broadcastMsg('RoomEvent', payload, recipients).catch((error: unknown) => {
        console.error(`RoomEvent broadcast failed for ${payload.roomId}`, error);
      });
    },
    broadcastSnapshot(snapshot: MsgRoomSnapshot): void {
      server.broadcastMsg('RoomSnapshot', snapshot, connections(snapshot.roomId))
        .catch((error: unknown) => console.error('Snapshot failed', error));
    },
  };
}

export function registerRoomMessages(server: WsServer<ServiceType>, world: World,
  accounts: Map<string, string>, sessions: Map<string, RoomSession>,
  transport: ReturnType<typeof roomTransport>, reconnections: RoomReconnections, store: AccountStore): void {
  registerRoomChatApi(server, world, sessions, transport.broadcastEvent, store, accounts);
  server.listenMsg('Chat', (call: MsgCall<MsgChat>) => {
    const session = sessions.get(call.conn.id);
    if (!session) return;
    for (const event of world.chat(session.playerId, call.msg.text, call.msg.channel)) {
      transport.broadcastEvent(event);
    }
  });
  server.flows.postDisconnectFlow.push(async input => {
    if (reconnections.retain(input.conn.id)) return input;
    const session = sessions.get(input.conn.id);
    if (session) {
      sessions.delete(input.conn.id);
      for (const event of world.leave(session.playerId)) transport.broadcastEvent(event);
      transport.broadcastRoomState(session.roomId);
    }
    accounts.delete(input.conn.id);
    return input;
  });
}
