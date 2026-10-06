import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';

/** Rebuilt public lobby: authenticated accounts outside all rooms only. */
export function registerLobbyChatApi(server: WsServer<ServiceType>, accounts: AccountStore,
  accountByConnection: Map<string, string>,
  sessionByConnection: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  let nextMessageId = 1;
  server.flows.postDisconnectFlow.push(input => {
    accountByConnection.delete(input.conn.id);
    return input;
  });
  server.implementApi('LobbyChat', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    if (sessionByConnection.has(call.conn.id)) {
      return call.error('请先离开房间再使用大厅聊天', {code: 'LOBBY_CHAT_IN_ROOM'});
    }
    const text = call.req.text;
    if (typeof text !== 'string' || text.length > 72 || /[\u0000-\u001f\u007f]/.test(text) || !text.trim()) {
      return call.error('请输入1至72字符的有效文本', {code: 'CHAT_REJECTED'});
    }
    const trimmed = text.trim();
    const message = {id: nextMessageId++, accountId, text: trimmed,
      message: `${accounts.displayName(accountId)}: ${trimmed}`};
    const recipients = server.connections.filter(connection => accountByConnection.has(connection.id)
      && !sessionByConnection.has(connection.id));
    await server.broadcastMsg('LobbyChat', message, recipients);
    await call.succ({message});
  });
}
