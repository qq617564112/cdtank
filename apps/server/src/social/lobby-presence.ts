import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';

/** Current authenticated lobby connections, deduplicated by rebuilt account identity. */
export function registerLobbyPresenceApi(server: WsServer<ServiceType>,
  accountByConnection: ReadonlyMap<string, string>,
  sessionByConnection: ReadonlyMap<string, {roomId: string; playerId: string}>,
  displayName: (accountId: string) => string): void {
  server.implementApi('LobbyPlayers', async call => {
    if (!accountByConnection.has(call.conn.id)) {
      return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    }
    if (sessionByConnection.has(call.conn.id)) {
      return call.error('请先离开房间再查看大厅成员', {code: 'LOBBY_PLAYERS_IN_ROOM'});
    }
    const ids = new Set<string>();
    for (const connection of server.connections) {
      const accountId = accountByConnection.get(connection.id);
      if (accountId && !sessionByConnection.has(connection.id)) ids.add(accountId);
    }
    const players = [...ids].sort().map(accountId => ({accountId,
      name: displayName(accountId)}));
    await call.succ({players});
  });
}
