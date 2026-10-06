import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';

/** Narrow public target profile query; never grants titles or exposes the authenticated profile. */
export function registerPlayerProfileApi(server: WsServer<ServiceType>, accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>): void {
  server.implementApi('PlayerProfile', async call => {
    if (!accountByConnection.has(call.conn.id)) {
      return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    }
    try {
      await call.succ(accounts.playerProfile(call.req.targetAccountId));
    } catch (error) {
      if (error instanceof Error && error.message === '目标账户不存在') {
        await call.error(error.message, {code: 'PLAYER_PROFILE_TARGET_NOT_FOUND'});
        return;
      }
      throw error;
    }
  });
}
