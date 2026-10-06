import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import type {World} from '../world';
import type {MsgFriendChat} from '../../../shared/protocols/MsgFriendChat';

/** Rebuilt unilateral friends across authenticated lobby and room connections. */
export function registerFriendChatApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, accountByConnection: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  let nextMessageId = 1;
  server.implementApi('FriendChat', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const {text, roomId, round} = call.req;
    if (typeof text !== 'string' || text.length > 72 || /[\u0000-\u001f\u007f]/.test(text)
        || !text.trim() || (roomId !== undefined) !== (round !== undefined)) {
      return call.error('请输入1至72字符文本及完整房间信息', {code: 'FRIEND_CHAT_REJECTED'});
    }
    const session = sessions.get(call.conn.id);
    if (roomId !== undefined) {
      const snapshot = session && world.snapshot(session.roomId);
      if (!session || !snapshot || !snapshot.players.some(player => player.id === session.playerId)) {
        return call.error('请先加入房间', {code: 'NOT_JOINED'});
      }
      if (roomId !== session.roomId || round !== snapshot.match?.round) {
        return call.error('房间或局号已变化，请刷新后重试', {code: 'ROUND_CONFLICT'});
      }
    } else if (session) {
      return call.error('请附带当前房间及局号', {code: 'FRIEND_CHAT_IN_ROOM'});
    }
    const online = server.connections.filter(connection => accountByConnection.has(connection.id));
    const onlineIds = new Set(online.map(connection => accountByConnection.get(connection.id)!));
    const friends = accounts.friends(accountId, {operation: 'QUERY'}).filter(id => onlineIds.has(id)
      && !accounts.isBlocked(id, accountId));
    if (!friends.length) return call.error('当前没有可接收消息的在线好友', {code: 'FRIEND_CHAT_NO_RECIPIENTS'});
    const senderName = accounts.displayName(accountId), trimmed = text.trim();
    const message: MsgFriendChat = {id: nextMessageId++, accountId, senderName, text: trimmed,
      message: `[好友] ${senderName}: ${trimmed}`, ...(roomId === undefined ? {} : {roomId, round})};
    const recipients = new Set([accountId, ...friends]);
    await server.broadcastMsg('FriendChat', message,
      online.filter(connection => recipients.has(accountByConnection.get(connection.id)!)));
    await call.succ({message, recipientCount: friends.length});
  });
}
