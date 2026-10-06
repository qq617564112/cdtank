export interface ReqEquipment {
  operation: 'QUERY' | 'EQUIP' | 'UNEQUIP';
  target?: 'PART' | 'DECORATION' | 'MARK';
  slot?: number;
  instanceId?: number;
}
export interface ResEquipment {
  slots: number[];
  slotCount: number;
  decorationInstanceId: number;
  markInstanceId: number;
  profile: {bytes: number[]; strings: [string, string]};
}
