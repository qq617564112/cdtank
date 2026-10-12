import type {RoleCombatState} from '../../../apps/server/src/battle/roles/combat-state';

/** Services called by original manager4259ae after the role lifecycle method. */
export interface RoleLifecycleNotificationServices {
  readonly roleId: number;
  readonly localRole: RoleCombatState;
  readonly statusChanged?: (role: RoleCombatState, status: 0 | 1) => void;
  readonly death?: (role: RoleCombatState) => void;
  readonly respawn?: (role: RoleCombatState) => void;
  readonly localRelationChanged?: (value: number) => void;
  queryLocalRelation(role: RoleCombatState): number;
  activateId(id: number): void;
  activateRole(role: RoleCombatState): void;
  refreshRole(role: RoleCombatState): void;
  deathFollowup(role: RoleCombatState, argument: 0): void;
}

/** Original4259ae with base-role vtable5c41b8; services retain their own behavior. */
export function dispatchRoleLifecycleNotification(
  role: RoleCombatState | undefined,
  status: 0 | 1 | 2 | 3,
  services: RoleLifecycleNotificationServices,
): void {
  if (!role) return;
  role.setStatus(status);
  switch (status) {
    case 0:
    case 1:
      services.statusChanged?.(role, status);
      break;
    case 2:
      services.activateId(role.record ? services.roleId : 0);
      services.respawn?.(role);
      services.activateRole(role);
      services.refreshRole(role);
      break;
    case 3:
      services.death?.(role);
      if (services.localRelationChanged) {
        services.localRelationChanged(services.queryLocalRelation(services.localRole));
      }
      services.deathFollowup(role, 0);
      break;
  }
}
