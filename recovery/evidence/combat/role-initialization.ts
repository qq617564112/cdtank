/** Original43291e returns1 when any required role/owned-record pointer is absent. */
export function needsRoleInitialization(roleRecord: unknown,
    ownedBase: unknown, ownedEquipment: unknown): boolean {
  return roleRecord == null || ownedBase == null || ownedEquipment == null;
}

/** Original422ba6 overrides the base gate in network role vtable5c2c28. */
export function needsBattleRoleInitialization(roleRecord: unknown): boolean {
  return roleRecord == null;
}
