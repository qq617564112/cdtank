import type {AccountStore} from '../account-store';
import type {World} from '../world';
import {TANKS, type TankConfig} from '../config';
import {resolveOwnedRoleTank} from './owned/definition';

/** Bind the authenticated account to the same participant used by room APIs. */
export function accountBattleBinding(accounts: AccountStore, world: World,
  accountByConnection: ReadonlyMap<string, string>) {
  function ownedTank(accountId: string, instanceId: number): TankConfig {
    const tank = resolveOwnedRoleTank(accounts.roleRecords(accountId).equipment, instanceId,
      id => TANKS.find(value => value.id === id));
    if (!tank) throw new Error('选中战车的归属或定义无效');
    return tank;
  }

  return {
    ownedTank,
    roomTankId(connectionId: string, requestedId: number): number {
      const accountId = accountByConnection.get(connectionId);
      const profile = accountId ? accounts.roleProfile(accountId) : undefined;
      if (!accountId || !profile) return requestedId;
      const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
      return ownedTank(accountId, view.getUint32(0xa8, true)).id;
    },
    bindAccountState(connectionId: string, playerId: string): void {
      const accountId = accountByConnection.get(connectionId);
      if (accountId) {
        world.bindInventory(playerId, accounts.inventory(accountId));
        world.bindRoleSources(playerId, accounts.selectedRoleSources(accountId));
        world.bindEquipmentProfile(playerId, accounts.roleProfile(accountId));
        world.bindTitle(playerId, accounts.currentTitle(accountId));
      }
    },
  };
}

/** Persistent consumption follows the player's current authenticated connection. */
export function consumeAccountBattleItem(accounts: AccountStore,
  accountByConnection: ReadonlyMap<string, string>,
  sessionByConnection: ReadonlyMap<string, {playerId: string}>,
  playerId: string, instanceId: number, expectedOwned: number, itemTableId: number): boolean {
  const connection = [...sessionByConnection.entries()].find(([, session]) => session.playerId === playerId);
  if (!connection) return false;
  const accountId = accountByConnection.get(connection[0]);
  return accountId !== undefined && accounts.consumeItem(accountId, instanceId, expectedOwned, itemTableId);
}
