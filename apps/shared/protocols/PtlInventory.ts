import type {InventoryItemRecord} from '../combat/inventory-query';

/** ownedQuantity preserves MyItem+10: stack count for consumables, remaining minutes for durable parts.
 * Unnamed fields retain original offsets; float payloads preserve all32 bits. */
export interface InventoryWireRecord extends InventoryItemRecord {
  field8: number;
  float24Bits: number;
  float28Bits: number;
  float2cBits: number;
}

export interface ReqInventory {}
export interface ResInventory {records: InventoryWireRecord[]; hotkeys: number[];}
