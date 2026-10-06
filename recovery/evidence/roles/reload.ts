export interface RoleReloadFields {
  baseDuration: number;
  type1Factor: number;
}

/** Original 0x4329fd: signed32 multiplication, then each f32 field addition. */
export function accumulateRoleReload(fields: RoleReloadFields, delay: number,
                                     loadTime: number, multiplier: number): RoleReloadFields {
  return {baseDuration: Math.fround(Math.fround(fields.baseDuration) + Math.imul(delay, multiplier)),
    type1Factor: Math.fround(Math.fround(fields.type1Factor) + Math.imul(loadTime, multiplier))};
}

/** Original role recomputation after equipment/skill additions have accumulated.
 * Inputs are role +0x50/+0x54 before bounds and conversion, not TankDelay alone.
 */
export function computeRoleReload(baseDuration: number, type1Factor: number,
    limits: {lower: number; upper: number}): {
  normalSeconds: number; type1Seconds: number;
} {
  let base = Math.fround(baseDuration);
  if (base > Math.fround(limits.upper)) base = Math.fround(limits.upper);
  if (base < Math.fround(limits.lower)) base = Math.fround(limits.lower);
  // Original fst +0x50 stores f32 but leaves the unrounded product on x87
  // for the following multiply; do not use normalSeconds in the second branch.
  const scaled = base * Math.fround(.1);
  return {normalSeconds: Math.fround(scaled),
    type1Seconds: Math.fround(scaled * Math.fround(type1Factor) * Math.fround(.03))};
}

/** Original428cd2: optional UI preparation precedes confirmation and may return early. */
export function applyRoleAmmoChangeReloadNotification(input: {
  field0c: number; seconds: number; currentSeconds(): number;
}, state: {roleFloatFields: Map<number, number>; nextAvailableSeconds: number} | undefined,
observers: {prepareUi?(): boolean; ammoChanged?(value: number): void; duration?(seconds: number): void; missingRole?(): void}): void {
  if (!state) {observers.missingRole?.(); return;}
  if (observers.prepareUi && !observers.prepareUi()) return;
  observers.ammoChanged?.(input.field0c >>> 0);
  const seconds = Math.fround(input.seconds);
  state.roleFloatFields.set(0x54, seconds);
  state.nextAvailableSeconds = Math.fround(input.currentSeconds() + seconds);
  observers.duration?.(seconds);
}
