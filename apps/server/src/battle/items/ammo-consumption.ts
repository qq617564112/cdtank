import {defaultAmmoId} from '../../../../shared/content/catalog';
import type {MsgPlayerInput, MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {confirmAcceptedAmmoSelection} from './ammo-confirmation';

export type ConsumeAmmoItem = (playerId: string, instanceId: number,
  expectedOwned: number, itemTableId: number) => boolean;

/** Rebuilt finite ammo authority; persistence commits before counts, reload or shot. */
export function consumeConfirmedAmmo(roomId: string, player: {
  id: string; x: number; y: number; z: number;
  combat: RoleCombatState; inventory: InventoryWireRecord[]; input: MsgPlayerInput;
}, consumeItem: ConsumeAmmoItem | undefined, events: MsgRoomEvent[]): boolean {
  const slot = player.combat.selectedAmmoSlot;
  const itemId = player.combat.currentAmmoTableId;
  if (slot === 1 && itemId === defaultAmmoId()) return true;
  const instanceId = player.combat.record?.arrays.get(0)?.[slot - 2];
  const item = instanceId === undefined ? undefined
    : player.inventory.find(record => (record.instanceId >>> 0) === (instanceId >>> 0));
  const reject = (message: string, reset: boolean): false => {
    if (reset) confirmAcceptedAmmoSelection(player.combat, player.inventory, 1);
    // A later ordinary input can fire default ammo; this held input is rejected once.
    player.input.fire = false;
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: player.x, y: player.y, z: player.z, skillId: itemId});
    return false;
  };
  if (slot < 2 || slot > 4 || !item || item.itemTableId !== itemId
      || item.ownedQuantity <= 0 || item.battleQuantity <= 0) {
    return reject('弹药不足，已切换普通弹药', true);
  }
  try {
    if (consumeItem && !consumeItem(player.id, item.instanceId, item.ownedQuantity, itemId)) {
      return reject('物品数量已变化，请重新进入房间', false);
    }
  } catch {
    return reject('物品保存失败，请稍后再试', false);
  }
  item.ownedQuantity -= 1;
  item.battleQuantity -= 1;
  player.combat.setBulletCount(item.battleQuantity);
  events.push({roomId, type: 'ammoConsumed', message: '消耗一发特殊弹药', playerId: player.id,
    targetId: '', value: item.battleQuantity, x: player.x, y: player.y, z: player.z, skillId: itemId});
  return true;
}
