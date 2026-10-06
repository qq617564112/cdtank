import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

export function registerPartMaintenanceApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, catalog: CombatCatalog, identities: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>, broadcast: (roomId: string) => void): void {
  server.implementApi('PartMaintenance', async call => {
    const accountId = identities.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessions.get(call.conn.id);
    if (call.req.operation === 'MAINTAIN' && session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段维修部件', {code: 'PART_MAINTENANCE_REJECTED'});
    }
    try {
      const result = accounts.partMaintenance(accountId, call.req, catalog);
      if (session && result.maintained && !result.replayed) {
        world.bindInventory(session.playerId, accounts.inventory(accountId), true);
        world.bindEquipmentProfile(session.playerId, accounts.roleProfile(accountId)!);
        broadcast(session.roomId);
      }
      await call.succ(result);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '部件维修失败', {code: 'PART_MAINTENANCE_REJECTED'});
    }
  });
}
