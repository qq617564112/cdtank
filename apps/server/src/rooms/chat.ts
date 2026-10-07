import type {MsgRoomEvent} from '../../../shared/protocols';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {World} from '../world';
import type {AccountStore} from '../account-store';

/** Acknowledged normal-page chat, using the same authority as legacy messages. */
export function registerRoomChatApi(server: WsServer<ServiceType>, world: World,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>,
  broadcast: (event: MsgRoomEvent) => void, accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>): void {
  server.implementApi('RoomChat', async call => {
    const session = sessions.get(call.conn.id);
    if (call.req.channel === 6) {
      const accountId = accountByConnection.get(call.conn.id);
      if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
      const {text} = call.req;
      if (session) {
        const player = world.snapshot(session.roomId)?.players.find(player => player.id === session.playerId);
        if (!player) return call.error('请输入1至72字符的有效内容', {code: 'CHAT_REJECTED'});
      }
      if (typeof text !== 'string' || !text.trim() || text.length > 72
          || /[\u0000-\u001f\u007f]/.test(text)) {
        return call.error('请输入1至72字符的有效内容', {code: 'CHAT_REJECTED'});
      }
      const roomId = session?.roomId ?? '';
      const playerId = session?.playerId ?? '';
      try {accounts.submitGmQuestion(accountId, roomId, playerId, text.trim());}
      catch {return call.error('问题提交失败，请稍后重试', {code: 'GM_SUBMIT_FAILED'});}
      return call.succ({roomId, playerId,
        message: '你提交的问题已被接受，待管理人员确认后，会进行处理。此为系统自动回复。'});
    }
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
