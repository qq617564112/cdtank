export function calculateQualifiedBackCriticalBonus(critical: boolean,
  facet: 'FRONT' | 'SIDE' | 'BACK', qualifiedBonus: number | undefined): number {
  return critical && facet === 'BACK' && qualifiedBonus !== undefined ? qualifiedBonus : 0;
}
