import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';

/** Rebuilt whisper resolves current authenticated lobby accounts for each request. */
export function registerLobbyWhisperApi(server: WsServer<ServiceType>, accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>,
  sessionByConnection: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  let nextMessageId = 1;
  server.implementApi('LobbyWhisper', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    if (sessionByConnection.has(call.conn.id)) {
      return call.error('请先离开房间再发送密语', {code: 'WHISPER_IN_ROOM'});
    }
    const {text, targetAccountId, targetName} = call.req;
    if (typeof text !== 'string' || text.length > 72 || /[\u0000-\u001f\u007f]/.test(text) || !text.trim()) {
      return call.error('请输入1至72字符的有效文本', {code: 'WHISPER_REJECTED'});
    }
    if ((targetAccountId !== undefined) === (targetName !== undefined)
        || targetAccountId !== undefined && !targetAccountId.trim()
        || targetName !== undefined && !targetName.trim()) {
      return call.error('请选择唯一的密语目标', {code: 'WHISPER_REJECTED'});
    }
    const lobbyConnections = server.connections.filter(connection => accountByConnection.has(connection.id)
      && !sessionByConnection.has(connection.id));
    const lobbyAccounts = new Set(lobbyConnections.map(connection => accountByConnection.get(connection.id)!));
    let target = targetAccountId;
    if (targetName !== undefined) {
      const candidates = [...lobbyAccounts].filter(id => accounts.displayName(id) === targetName.trim());
      if (candidates.length > 1) return call.error('有多名大厅成员使用该昵称，请按账户选择', {code: 'WHISPER_AMBIGUOUS'});
      target = candidates[0];
    }
    if (!target || !lobbyAccounts.has(target)) {
      return call.error('密语目标当前不在大厅', {code: 'WHISPER_OFFLINE'});
    }
    if (target === accountId) return call.error('不能向自己发送密语', {code: 'WHISPER_SELF'});
    if (accounts.isBlocked(target, accountId)) return call.error('对方已屏蔽你的密语', {code: 'WHISPER_BLOCKED'});
    const senderName = accounts.displayName(accountId), name = accounts.displayName(target);
    const trimmed = text.trim();
    const message = {id: nextMessageId++, accountId, targetAccountId: target,
      senderName, targetName: name, text: trimmed, message: `[密语] ${senderName} → ${name}: ${trimmed}`};
    const recipients = lobbyConnections.filter(connection => {
      const id = accountByConnection.get(connection.id);
      return id === accountId || id === target;
    });
    await server.broadcastMsg('LobbyWhisper', message, recipients);
    await call.succ({message});
  });
}
