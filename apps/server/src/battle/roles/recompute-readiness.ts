export interface RoleRecomputePrerequisites {
  base: unknown;
  equipment: unknown;
  skills: unknown;
  items: unknown;
  itemResolver: unknown;
  tank: unknown;
  pet: unknown;
}

/** Original433466 validates these seven sources before writing any role attributes. */
export function missingRoleRecomputeSource(sources: RoleRecomputePrerequisites):
    keyof RoleRecomputePrerequisites | undefined {
  for (const name of ['base', 'equipment', 'skills', 'items', 'itemResolver', 'tank', 'pet'] as const) {
    if (sources[name] == null) return name;
  }
  return undefined;
}
