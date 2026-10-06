import type {CombatDataScaleDefinition} from '../../../../shared/combat/catalog';

export interface RoleDataScaleLimit {lower: number; upper: number}
export const ROLE_MAX_HP_DATA_SCALE_ID = 1;

// Original43928a writes only these IDs into combat globals.
const FLOAT_LIMIT_IDS = new Set([3, 4, 5, 6, 8, 10, 12, 13, 16, 19, 22]);
const INTEGER_LIMIT_IDS = new Set([1, 7, 9, 11, 14, 15, 17, 20, 27, 28, 29, 30]);

export function applyRoleDataScale(
  limits: Map<number, RoleDataScaleLimit>, row: CombatDataScaleDefinition,
): void {
  const id = row.id | 0;
  if (FLOAT_LIMIT_IDS.has(id)) {
    limits.set(id, {lower: Math.fround(row.minimum | 0), upper: Math.fround(row.maximum | 0)});
  } else if (INTEGER_LIMIT_IDS.has(id)) {
    limits.set(id, {lower: row.minimum | 0, upper: row.maximum | 0});
  }
}

export function readRoleDataScaleLimits(
  rows: readonly CombatDataScaleDefinition[],
): Map<number, RoleDataScaleLimit> {
  const limits = new Map<number, RoleDataScaleLimit>();
  for (const row of rows) applyRoleDataScale(limits, row);
  return limits;
}
