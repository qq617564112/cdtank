import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {consumableShopItems, partShopItems} from './shop-catalog';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

/** Rebuilt purchase authority; source prices do not establish GGet eligibility. */
export function registerShopApi(server: WsServer<ServiceType>, accounts: AccountStore,
    world: World, catalog: CombatCatalog, identities: ReadonlyMap<string, string>,
    sessions: ReadonlyMap<string, {roomId: string; playerId: string}>,
    broadcast: (roomId: string) => void): void {
  const items = [...consumableShopItems(catalog), ...partShopItems(catalog)];
  server.implementApi('Shop', async call => {
    const accountId = identities.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessions.get(call.conn.id);
    if (call.req.operation === 'BUY' && session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段购买道具', {code: 'SHOP_REJECTED'});
    }
    try {
      const result = accounts.shop(accountId, items, call.req);
      if (session && call.req.operation === 'BUY' && !result.replayed) {
        world.bindInventory(session.playerId, accounts.inventory(accountId));
        world.bindEquipmentProfile(session.playerId, accounts.roleProfile(accountId)!);
        broadcast(session.roomId);
      }
      await call.succ(result);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '购买失败', {code: 'SHOP_REJECTED'});
    }
  });
}
