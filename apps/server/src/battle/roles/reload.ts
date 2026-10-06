/** Original 0x432951: getter9 (+0x24) and FuncZ1 scale only trigger type14. */
export function roleSkillMultiplier(triggerType: number, roleValue9: number, funcZ1: number): number {
  const difference = (roleValue9 - funcZ1) | 0;
  return triggerType === 14 && difference > 0 ? difference : 1;
}

/** CDTank.exe 0x435499: role flag11 gates inclusive f32 deadline comparison. */
export function isRoleFireReady(permitted: boolean, currentSeconds: number,
                                nextAvailableSeconds: number): boolean {
  return permitted && Math.fround(currentSeconds) >= Math.fround(nextAvailableSeconds);
}

/** Original423092 local fire notification: getter4=m_iBullet, not ammo selection. */
export function applyRoleFireReloadNotification(input: {
  local: boolean; bulletCount: number; normalSeconds: number; lastBulletSeconds: number;
  currentSeconds(): number;
}, state: {nextAvailableSeconds: number}, observers: {
  duration?(seconds: number): void;
  localComplete?(): void;
  forwarded(): void;
}): void {
  if (input.local) {
    const seconds = Math.fround((input.bulletCount | 0) === 1
      ? input.lastBulletSeconds : input.normalSeconds);
    state.nextAvailableSeconds = Math.fround(input.currentSeconds() + seconds);
    observers.duration?.(seconds);
    observers.localComplete?.();
  }
  observers.forwarded();
}
