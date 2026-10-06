export interface RoleMovementRecord {
  move: number;
  turn: number;
}

/** Original432658 selector10/11: write f32 then notify9/10, without marking dirty. */
export function setRoleMovementProperty(record: RoleMovementRecord | undefined,
    selector: 10 | 11, value: number, notify: (index: 9 | 10) => void): boolean {
  if (!record) return false;
  if (selector === 10) record.move = Math.fround(value);
  else record.turn = Math.fround(value);
  notify(selector === 10 ? 9 : 10);
  return true;
}
