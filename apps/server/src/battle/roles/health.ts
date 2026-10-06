/** Original role-record signed integers +0x54 (HP), +0x58 (maximum HP). */
export interface RoleHealthRecord {
  hp: number;
  maxHp: number;
}

/** Original433250 selector15: notify raw assignment before clamping. */
export function setRoleHp(
  record: RoleHealthRecord | undefined,
  value: number,
  notify: (index: 12) => void,
  changed?: (previousHp: number) => void,
): boolean {
  if (!record) return false;
  const previousHp = record.hp | 0;
  record.hp = value | 0;
  notify(12);
  if (record.hp < 0) record.hp = 0;
  if (record.hp > (record.maxHp | 0)) record.hp = record.maxHp | 0;
  if (record.hp !== previousHp) changed?.(previousHp);
  return true;
}
