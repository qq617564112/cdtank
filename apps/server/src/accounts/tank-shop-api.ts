import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

export function registerTankShopApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, identities: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>,
  broadcast: (roomId: string) => void): void {
  server.implementApi('TankShop', async call => {
    const accountId = identities.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessions.get(call.conn.id);
    if (call.req.operation === 'BUY' && session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段购买战车', {code: 'TANK_SHOP_REJECTED'});
    }
    try {
      const result = accounts.tankShop(accountId, call.req);
      if (session && call.req.operation === 'BUY' && !result.replayed) {
        world.bindEquipmentProfile(session.playerId, accounts.roleProfile(accountId)!);
        broadcast(session.roomId);
      }
      await call.succ(result);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '购买战车失败', {code: 'TANK_SHOP_REJECTED'});
    }
  });
}
