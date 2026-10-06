import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

export function registerOwnedRoleSaleApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, catalog: CombatCatalog, identities: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  server.implementApi('OwnedRoleSale', async call => {
    const accountId = identities.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessions.get(call.conn.id);
    if (call.req.operation === 'SELL' && session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段出售角色', {code: 'OWNED_ROLE_SALE_REJECTED'});
    }
    try {await call.succ(accounts.ownedRoleSale(accountId, call.req, catalog));}
    catch (error) {await call.error(error instanceof Error ? error.message : '出售失败', {code: 'OWNED_ROLE_SALE_REJECTED'});}
  });
}
