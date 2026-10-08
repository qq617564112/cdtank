export interface ReqEquipment {
  operation: 'QUERY' | 'EQUIP' | 'UNEQUIP';
  target?: 'PART' | 'DECORATION' | 'MARK';
  slot?: number;
  instanceId?: number;
  /** Owned tank to inspect or configure; omission uses the selected battle tank. */
  tankInstanceId?: number;
}
export interface EquipmentBinding {
  instanceId: number;
  tankInstanceId: number;
  target: 'PART' | 'DECORATION' | 'MARK';
  slot: number;
}
export interface ResEquipment {
  slots: number[];
  slotCount: number;
  decorationInstanceId: number;
  markInstanceId: number;
  tankInstanceId: number;
  bindings: EquipmentBinding[];
  /** Equipment preview projection for tankInstanceId; does not change the battle selection. */
  profile: {bytes: number[]; strings: [string, string]};
}
