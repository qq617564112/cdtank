import type {CombatItemDefinition} from '../../../apps/shared/combat/catalog';
export interface RoleAmmoUiDefinition {
  name: string;
  /** Original ItemTable record+74 selects the03/attack1 online effect name. */
  field74: number;
}
export interface RoleAmmoChangeUi {
  hotkeysPresent: boolean;
  findItem(instanceId: number): {itemTableId: number} | undefined;
  findDefinition(itemTableId: number): RoleAmmoUiDefinition | undefined;
  localizedFormat: string;
  updateAttackEffect(value: number): void;
  updateText(text: string): void;
}

/** Original428d10–428e72 optional UI path; false suppresses all reload callbacks. */
export function prepareRoleAmmoChangeUi(instanceId: number, ui: RoleAmmoChangeUi): boolean {
  if (!ui.hotkeysPresent) return false;
  const item = ui.findItem(instanceId >>> 0);
  const definition = ui.findDefinition(item ? item.itemTableId >>> 0 : 2001);
  if (!definition) return false;
  ui.updateAttackEffect(definition.field74 >>> 0);
  ui.updateText(ui.localizedFormat.replace('%s', () => definition.name));
  return true;
}

/** Resolve confirmed UI data from an actual definition; no effect0 substitution. */
export function roleAmmoUiDefinition(item: CombatItemDefinition | undefined): RoleAmmoUiDefinition | undefined {
  if (!item?.effects?.length) return undefined;
  return {name: item.name, field74: item.effects[0].effectId >>> 0};
}
