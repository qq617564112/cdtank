import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

/** Acquisition leaves the selected pet unchanged until an explicit SelectRole. */
export function registerPetShopApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, identities: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>): void {
  server.implementApi('PetShop', async call => {
    const accountId = identities.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessions.get(call.conn.id);
    if (call.req.operation === 'BUY' && session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段购买宠物', {code: 'PET_SHOP_REJECTED'});
    }
    try {
      await call.succ(accounts.petShop(accountId, call.req));
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '购买宠物失败', {code: 'PET_SHOP_REJECTED'});
    }
  });
}
