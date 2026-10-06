import type {KitbagAssignmentResult, KitbagCancellationResult} from '../../accounts/kitbag-configuration';
import type {RoleCombatState} from '../roles/combat-state';

/** Original43bf59: result4 replaces all seven entries through the role setter. */
export function applyKitbagAssignment(role: RoleCombatState | undefined,
  message: KitbagAssignmentResult, notify?: (code: number) => void): void {
  if (message.result === 4) {
    if (!role) return;
    role.setArray(0, message.hotkeys);
  }
  notify?.(message.result);
}

/** Original43bfd2: result1 clears one entry directly, without notify28/dirty. */
export function applyKitbagCancellation(role: RoleCombatState | undefined,
  message: KitbagCancellationResult, notify?: (code: number) => void): void {
  if (message.result === 1) {
    const hotkeys = role?.record?.arrays.get(0);
    if (!hotkeys) return;
    hotkeys[message.slot - 1] = 0;
  }
  notify?.(message.result);
}
