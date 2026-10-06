import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import {BlacklistRequestError} from '../accounts/social/blacklist';

export function registerBlacklistApi(server: WsServer<ServiceType>, accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>,
  sessionByConnection: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  server.implementApi('Blacklist', async call => {
    const owner = accountByConnection.get(call.conn.id);
    if (!owner) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    try {
      const ids = accounts.blacklist(owner, call.req);
      const online = new Set<string>(), inRoom = new Set<string>();
      for (const connection of server.connections) {
        const id = accountByConnection.get(connection.id);
        if (!id) continue;
        online.add(id);
        if (sessionByConnection.has(connection.id)) inRoom.add(id);
      }
      await call.succ({blocked: ids.map(accountId => ({accountId, name: accounts.displayName(accountId),
        online: online.has(accountId), inRoom: inRoom.has(accountId),
        title: accounts.currentTitle(accountId)}))});
    } catch (error) {
      if (!(error instanceof BlacklistRequestError)) throw error;
      await call.error(error.message, {code: error.code});
    }
  });
}
