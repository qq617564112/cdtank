/** Original4661c9 formats a signed DWORD using minimum precision3, not width3. */
export function roleAmmoEffectName(value: number): string {
  const signed = value | 0;
  return `_root\\online\\${signed < 0 ? '-' : ''}${String(Math.abs(signed)).padStart(3, '0')}`;
}

/** Original03/attack1 override updates every record and preserves other events. */
export function roleAmmoActionEffectName(action: string, event: string,
  original: string, override: string | undefined): string {
  return override !== undefined && action === '03' && event === 'attack1' ? override : original;
}
