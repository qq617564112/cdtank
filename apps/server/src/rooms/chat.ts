import type {MsgRoomEvent} from '../../../shared/protocols';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {World} from '../world';

/** Acknowledged normal-page chat, using the same authority as legacy messages. */
export function registerRoomChatApi(server: WsServer<ServiceType>, world: World,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>,
  broadcast: (event: MsgRoomEvent) => void): void {
  server.implementApi('RoomChat', async call => {
    const session = sessions.get(call.conn.id);
    if (!session) return call.error('请先加入房间', {code: 'NOT_JOINED'});
    const event = world.chat(session.playerId, call.req.text, call.req.channel)[0];
    if (!event || event.roomId !== session.roomId) {
      return call.error('请选择当前玩法支持的频道并输入1至72字符的有效文本', {code: 'CHAT_REJECTED'});
    }
    broadcast(event);
    await call.succ({roomId: event.roomId, playerId: event.playerId, message: event.message});
  });
}

export function roomChat(roomId: string, player: {id: string; name: string}, text: string,
  channel: number): MsgRoomEvent[] {
  if ((channel !== 0 && channel !== 1) || typeof text !== 'string' || text.length > 72
      || /[\u0000-\u001f\u007f]/.test(text) || !text.trim()) return [];
  return [{roomId, type: 'chat', message: `${channel === 1 ? '[队伍] ' : ''}${player.name}: ${text.trim()}`, playerId: player.id,
    targetId: '', value: channel, x: 0, y: 0, z: 0, skillId: undefined}];
}
