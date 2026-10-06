import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import type {World} from '../world';
import {TankUpgradeError} from './tank-upgrade';

interface TankUpgradeSession {
  roomId: string;
  playerId: string;
}

export function registerTankUpgradeApi(
  server: WsServer<ServiceType>,
  accounts: AccountStore,
  world: World,
  accountByConnection: ReadonlyMap<string, string>,
  sessionByConnection: ReadonlyMap<string, TankUpgradeSession>,
  broadcastRoomState: (roomId: string) => void,
): void {
  server.implementApi('TankUpgrade', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessionByConnection.get(call.conn.id);
    if (call.req.operation === 'UPGRADE' && session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段改装战车', {code: 'UPGRADE_REJECTED'});
    }
    try {
      const result = accounts.tankUpgrade(accountId, call.req);
      if (session && call.req.operation === 'UPGRADE' && !result.replayed) {
        world.bindInventory(session.playerId, accounts.inventory(accountId), true);
        world.bindRoleSources(session.playerId, accounts.selectedRoleSources(accountId));
        world.bindEquipmentProfile(session.playerId, accounts.roleProfile(accountId));
        broadcastRoomState(session.roomId);
      }
      await call.succ(result);
    } catch (error) {
      if (error instanceof TankUpgradeError) {
        return call.error(error.message, {code: error.code});
      }
      await call.error(error instanceof Error ? error.message : '战车改装失败', {code: 'UPGRADE_REJECTED'});
    }
  });
}
