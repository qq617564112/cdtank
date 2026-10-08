import {gameContent} from '../content/catalog';

export type EquipmentTarget = 'PART' | 'DECORATION' | 'MARK';

export function isAppearanceEffectItem(itemTableId: number): boolean {
  return gameContent().items.get(itemTableId)?.appearanceEffect ?? false;
}
export function equipmentTarget(itemTableId: number): EquipmentTarget | undefined {
  return gameContent().items.get(itemTableId)?.equipmentTarget;
}
