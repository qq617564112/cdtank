import type {CpuLoadoutItem} from '../../../shared/protocols/PtlCpu';
import {CPU_LOADOUT_ITEM_IDS} from '../../../shared/combat/cpu-loadout';
import {classifyItemId} from '../../../shared/combat/item-hotkeys';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import type {PlayerState} from '../battle/player-state';
import type {RoomState} from './state';
import {combatItems} from '../battle/catalog';
import {bindBattleInventory} from '../battle/preparation';
import {readyCpus} from './preparation';

/** World owns phase/round gates; configured stock is temporary CPU state only. */
export function configureRoomCpuLoadout(room: RoomState, owner: PlayerState,
  cpuId: string | undefined, loadout: CpuLoadoutItem[] | undefined): string {
  if (owner.cpu || room.creatorClientId !== owner.clientId) throw new Error('只有房主可以管理CPU');
  const cpu = cpuId ? room.players.get(cpuId) : undefined;
  if (!cpu?.cpu) throw new Error('CPU不存在');
  if (!Array.isArray(loadout) || loadout.length > 7) throw new Error('CPU配置无效');
  const hotkeys = Array<number>(7).fill(0);
  const records: InventoryWireRecord[] = [];
  const slots = new Set<number>();
  for (const entry of loadout) {
    const {slot, itemTableId, quantity} = entry;
    const definition = combatItems.get(itemTableId);
    if (!Number.isInteger(slot) || slot < 2 || slot > 8 || slots.has(slot)
        || !CPU_LOADOUT_ITEM_IDS.includes(itemTableId) || !definition
        || (slot <= 4 ? classifyItemId(itemTableId) !== 3
          : (itemTableId < 1 || itemTableId > 11) && itemTableId !== 13 && itemTableId !== 502)
        || !Number.isInteger(quantity) || quantity < 1 || quantity > definition.battleUseMax) {
      throw new Error('CPU配置物品或数量无效');
    }
    slots.add(slot);
    // Instance IDs are local to this temporary participant, never account IDs.
    hotkeys[slot - 2] = slot;
    records.push({instanceId: slot, itemTableId, ownedQuantity: quantity, battleQuantity: quantity,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0});
  }
  bindBattleInventory(room, cpu, {records, hotkeys});
  room.ready.clear();
  readyCpus(room);
  return cpu.id;
}
