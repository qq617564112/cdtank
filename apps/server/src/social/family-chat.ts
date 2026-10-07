import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {MsgFamilyChat} from '../../../shared/protocols/MsgFamilyChat';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

/** Live operator-assigned family channel across authenticated lobby and room connections. */
export function registerFamilyChatApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, accountByConnection: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  let nextMessageId = 1;
  server.implementApi('FamilyChat', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const {text, roomId, round} = call.req;
    if (typeof text !== 'string' || text.length < 1 || text.length > 72
        || /[\u0000-\u001f\u007f]/.test(text) || !text.trim()
        || (roomId !== undefined) !== (round !== undefined)) {
      return call.error('请输入1至72字符文本及完整房间信息', {code: 'FAMILY_CHAT_REJECTED'});
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
      return call.error('请附带当前房间及局号', {code: 'FAMILY_CHAT_IN_ROOM'});
    }
    const family = accounts.family(accountId);
    if (!family) return call.error('当前账户尚未加入家族', {code: 'FAMILY_CHAT_NO_FAMILY'});
    const senderName = accounts.displayName(accountId), trimmed = text.trim();
    const message: MsgFamilyChat = {id: nextMessageId++, accountId, senderName,
      familyId: family.id, familyName: family.name, text: trimmed,
      message: `[家族] ${senderName}: ${trimmed}`,
      ...(roomId === undefined ? {} : {roomId, round})};
    const recipients = server.connections.filter(connection => {
      const recipientAccountId = accountByConnection.get(connection.id);
      return recipientAccountId !== undefined && accounts.family(recipientAccountId)?.id === family.id;
    });
    const delivered = await server.broadcastMsg('FamilyChat', message, recipients);
    if (!delivered.isSucc) {
      return call.error('家族消息发送失败', {code: 'FAMILY_CHAT_DELIVERY_FAILED'});
    }
    const otherAccounts = new Set<string>();
    for (const connection of recipients) {
      const recipientAccountId = accountByConnection.get(connection.id);
      if (recipientAccountId && recipientAccountId !== accountId) otherAccounts.add(recipientAccountId);
    }
    await call.succ({message, recipientCount: otherAccounts.size});
  });
}
