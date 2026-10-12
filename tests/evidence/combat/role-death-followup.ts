/** Original role virtual+24 selector15 and virtual+14 selector15 adapters. */
export interface DeathFollowupRole {
  readonly petType: number;
  readonly id: number;
  readonly life: number;
  setLife(value: 0): void;
}

/** Original manager423157 dependencies, preserving the supplied role identity. */
export interface DeathFollowupServices<Role extends DeathFollowupRole> {
  readonly lifeChanged?: (id: number, life: number) => void;
  renderAction(role: Role, action: 0x77 | 0x78, category: 3, option: 0, enabled: 1): void;
  worldDeath(role: Role, argument: 0): void;
  deactivateId(id: number): void;
}

/** Complete original423157(role,0) orchestration; adapters own field storage. */
export function applyRoleDeathFollowup<Role extends DeathFollowupRole>(
  role: Role | undefined,
  services: DeathFollowupServices<Role>,
): void {
  if (!role) return;
  role.setLife(0);
  if (services.lifeChanged) services.lifeChanged(role.id, role.life);
  if (role.petType === 1 || role.petType === 2) {
    services.renderAction(role, role.petType === 1 ? 0x77 : 0x78, 3, 0, 1);
  }
  services.worldDeath(role, 0);
  services.deactivateId(role.id);
}
