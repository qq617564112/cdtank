import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

/** Rebuilt cross-account delivery; room/round belongs to the sender, not the target. */
export function registerRoomWhisperApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, accountByConnection: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  let nextMessageId = 1;
  server.implementApi('RoomWhisper', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessions.get(call.conn.id);
    const snapshot = session && world.snapshot(session.roomId);
    if (!session || !snapshot || !snapshot.players.some(player => player.id === session.playerId)) {
      return call.error('请先加入房间', {code: 'NOT_JOINED'});
    }
    if (call.req.roomId !== session.roomId || call.req.round !== snapshot.match?.round) {
      return call.error('房间或局号已变化，请刷新后重试', {code: 'ROUND_CONFLICT'});
    }
    const {text, targetName} = call.req;
    if (typeof text !== 'string' || text.length > 72 || /[\u0000-\u001f\u007f]/.test(text)
        || !text.trim() || !targetName.trim()) {
      return call.error('请输入有效昵称和1至72字符文本', {code: 'WHISPER_REJECTED'});
    }
    const online = server.connections.filter(connection => accountByConnection.has(connection.id));
    const ids = new Set(online.map(connection => accountByConnection.get(connection.id)!));
    const candidates = [...ids].filter(id => accounts.displayName(id) === targetName.trim());
    if (candidates.length > 1) return call.error('有多名在线成员使用该昵称', {code: 'WHISPER_AMBIGUOUS'});
    const targetAccountId = candidates[0];
    if (!targetAccountId) return call.error('密语目标当前不在线', {code: 'WHISPER_OFFLINE'});
    if (targetAccountId === accountId) return call.error('不能向自己发送密语', {code: 'WHISPER_SELF'});
    if (accounts.isBlocked(targetAccountId, accountId)) return call.error('对方已屏蔽你的密语', {code: 'WHISPER_BLOCKED'});
    const senderName = accounts.displayName(accountId), name = accounts.displayName(targetAccountId);
    const trimmed = text.trim();
    const message = {id: nextMessageId++, roomId: session.roomId, round: snapshot.match!.round,
      accountId, targetAccountId, senderName, targetName: name, text: trimmed,
      message: `[密语] ${senderName} → ${name}: ${trimmed}`};
    const recipients = online.filter(connection => {
      const id = accountByConnection.get(connection.id);
      return id === accountId || id === targetAccountId;
    });
    await server.broadcastMsg('RoomWhisper', message, recipients);
    await call.succ({message});
  });
}
