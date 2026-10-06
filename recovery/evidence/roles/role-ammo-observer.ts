import type {RoleCombatState} from '../../../apps/server/src/battle/roles/combat-state';

/** Original42f385 properties5/8: report current/max ammo only for the local role. */
export function observeRoleAmmoProperty(
  index: number,
  handlers: {
    stage(): number;
    findRole(): RoleCombatState | undefined;
    isLocal(role: RoleCombatState): boolean;
    updated?: (count: number, maximum: number) => void;
  },
): void {
  if (handlers.stage() === 1) return;
  const role = handlers.findRole();
  if (!role || (index !== 5 && index !== 8) || !handlers.isLocal(role) || !handlers.updated) return;
  handlers.updated(role.bulletCount, role.maxBulletCount);
}
