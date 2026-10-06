/** Original4d88f1 reads unsigned MyTank+34 and rounds remaining minutes up to days. */
export function sourceOwnedTankDays(durationMinutes?: number): string {
  return durationMinutes === undefined ? '' : `（${Math.ceil((durationMinutes >>> 0) / 1440)}天）`;
}
