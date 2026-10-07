import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import {PlayerSearchNameError} from '../accounts/display-name';

/** Exact persistent-nickname lookup projecting the same online/in-room/title facts as friends. */
export function registerPlayerSearchApi(server: WsServer<ServiceType>, accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>,
  sessionByConnection: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  server.implementApi('PlayerSearch', async call => {
    if (!accountByConnection.has(call.conn.id)) {
      return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    }
    try {
      const ids = accounts.playerSearchIds(call.req.name);
      const online = new Set<string>(), inRoom = new Set<string>();
      for (const connection of server.connections) {
        const id = accountByConnection.get(connection.id);
        if (!id) continue;
        online.add(id);
        if (sessionByConnection.has(connection.id)) inRoom.add(id);
      }
      await call.succ({players: ids.map(accountId => ({accountId, name: accounts.displayName(accountId),
        online: online.has(accountId), inRoom: inRoom.has(accountId),
        title: accounts.currentTitle(accountId)}))});
    } catch (error) {
      if (!(error instanceof PlayerSearchNameError)) throw error;
      await call.error(error.message, {code: error.code});
    }
  });
}
