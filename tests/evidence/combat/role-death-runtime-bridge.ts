/** Original4376bb/437626/436464 local lifecycle service dependencies. */
export interface RoleDeathRuntimeServices<Role> {
  readonly accountRoleId: number;
  roleId(role: Role): number;
  roleStatus(role: Role): number;
  currentStateType(): number;
  localRole(): Role | undefined;
  schedule(delay: 1, countdown: number): void;
  cancel(): void;
  countdownChanged?: (countdown: number) => void;
  reset?: () => void;
  complete?: () => void;
}

/** Death4376bb seeds the client callback; argument0 does not choose its duration. */
export function startRoleDeathRuntime<Role>(role: Role, services: RoleDeathRuntimeServices<Role>): void {
  if (services.roleId(role) === services.accountRoleId) services.schedule(1, 5);
}

/** Callback437626 reads the current client state type and local role each time. */
export function advanceRoleDeathRuntime<Role>(countdown: number, services: RoleDeathRuntimeServices<Role>): void {
  if (services.currentStateType() !== 4) return;
  const role = services.localRole();
  if (!role || services.roleStatus(role) === 2) {
    services.complete?.();
    return;
  }
  services.countdownChanged?.(countdown);
  if (countdown - 1 >= 0) services.schedule(1, countdown - 1);
}

/** Revive436464 cancels the shared callback key before invoking reset. */
export function resetRoleDeathRuntime<Role>(role: Role | undefined, services: RoleDeathRuntimeServices<Role>): void {
  const local = services.localRole();
  if (!local || !role || services.roleId(role) !== services.roleId(local)) return;
  services.cancel();
  services.reset?.();
}
