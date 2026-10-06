import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import type {KitbagInventory} from './inventory';
import type {RoleCombatState} from '../roles/combat-state';

/** Original426419 request gate; the caller supplies transport/authority handling.
 * This entry does not change selection, quantity or reload state. The keyboard
 * dispatcher checks quantity before reaching it; this entry has no count gate.
 */
export function requestRoleAmmoSelection(role: RoleCombatState | undefined,
  inventory: KitbagInventory, slot: number, send: (slot: number) => void): void {
  if (!role || role.status !== 2) return;
  const index = slot >>> 0;
  if (index > 8) return;
  if (index !== 1) {
    const hotkeys = role.record?.arrays.get(0);
    if (!hotkeys) return;
    const instanceId = hotkeys[index - 2] >>> 0;
    const record = inventory.primary.find(item => (item.instanceId >>> 0) === instanceId)
      ?? inventory.secondary.find(item => (item.instanceId >>> 0) === instanceId);
    if (!record || classifyItemId(record.itemTableId) !== 3) return;
  }
  // The original reads the current selection but also sends repeated selections.
  send(index);
}
