import {defaultAmmoId} from '../../../../shared/content/catalog';
import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';
import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import type {RoleCombatState} from '../roles/combat-state';
import {ensureSelectedAmmoSkills, resetAmmoMagazine} from '../roles/ammo-magazine';

/** Rebuilt server acceptance after the original keyboard/request gates. */
export function confirmAcceptedAmmoSelection(role: RoleCombatState,
  records: readonly BattleItemRecord[], slot: number): boolean {
  if (!role.record?.numericFields) return false;
  let itemId = defaultAmmoId();
  let quantity: number | undefined;
  if (slot !== 1) {
    const instanceId = role.record.arrays.get(0)?.[slot - 2];
    if (instanceId === undefined) return false;
    const record = records.find(item => (item.instanceId >>> 0) === (instanceId >>> 0));
    if (!record || classifyItemId(record.itemTableId) !== 3 || record.battleQuantity === 0) return false;
    itemId = record.itemTableId;
    quantity = record.battleQuantity;
  }
  const previousSlot = role.selectedAmmoSlot;
  const previousId = role.currentAmmoTableId;
  role.setSelectedAmmoSlot(slot);
  role.setCurrentAmmoTableId(itemId);
  if (!ensureSelectedAmmoSkills(role)) {
    role.setSelectedAmmoSlot(previousSlot);
    role.setCurrentAmmoTableId(previousId);
    return false;
  }
  if (quantity !== undefined) role.setBulletCount(quantity);
  return true;
}

/** Rebuilt life/round policy; the original status2 setter does not reset ammo. */
export function resetConfirmedAmmo(role: RoleCombatState): void {
  role.setSelectedAmmoSlot(1);
  role.setCurrentAmmoTableId(defaultAmmoId());
  ensureSelectedAmmoSkills(role);
  resetAmmoMagazine(role);
}
