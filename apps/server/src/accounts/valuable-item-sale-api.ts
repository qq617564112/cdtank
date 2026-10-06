import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

export function registerValuableItemSaleApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, catalog: CombatCatalog, identities: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>, broadcast: (roomId: string) => void,
  assertTradeAvailable: (accountId: string) => void): void {
  server.implementApi('ValuableItemSale', async call => {
    const accountId = identities.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const accountSessions = [...identities]
      .filter(([, id]) => id === accountId)
      .flatMap(([connectionId]) => sessions.get(connectionId) ? [sessions.get(connectionId)!] : []);
    if (call.req.operation === 'SELL') {
      try {
        assertTradeAvailable(accountId);
      } catch (error) {
        return call.error(error instanceof Error ? error.message : '请先结束交易', {code: 'VALUABLE_ITEM_SALE_REJECTED'});
      }
      if (accountSessions.some(session => !world.canConfigureInventory(session.playerId))) {
        return call.error('请在准备阶段出售贵重品', {code: 'VALUABLE_ITEM_SALE_REJECTED'});
      }
    }
    try {
      const result = accounts.valuableItemSale(accountId, call.req, catalog);
      if (accountSessions.length && result.sold && !result.replayed) {
        const inventory = accounts.inventory(accountId);
        const rooms = new Set<string>();
        for (const session of accountSessions) {
          world.bindInventory(session.playerId, inventory, true);
          rooms.add(session.roomId);
        }
        for (const roomId of rooms) broadcast(roomId);
      }
      await call.succ(result);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '贵重品出售失败', {code: 'VALUABLE_ITEM_SALE_REJECTED'});
    }
  });
}
