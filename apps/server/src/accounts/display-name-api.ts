import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';

export function registerDisplayNameApi(server: WsServer<ServiceType>, accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>,
  sessionByConnection: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  server.implementApi('DisplayName', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    if (call.req.name !== undefined && [...accountByConnection].some(([connectionId, id]) =>
      id === accountId && sessionByConnection.has(connectionId))) {
      return call.error('请先让该账户的所有连接离开房间再修改昵称', {code: 'NAME_IN_ROOM'});
    }
    try {
      const name = call.req.name === undefined ? accounts.displayName(accountId)
        : accounts.setDisplayName(accountId, call.req.name);
      await call.succ({name});
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '昵称确认失败', {code: 'NAME_REJECTED'});
    }
  });
}
