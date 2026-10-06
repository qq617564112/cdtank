/** Web authority consumes current qualified capacity without refilling spent state. */
export function resolveAttackCancellation(
    qualifiedMaximum: number | undefined,
    cancellationsSpent: number,
): {blocked: boolean; cancellationsSpent: number} {
  if (qualifiedMaximum === undefined || qualifiedMaximum <= cancellationsSpent) {
    return {blocked: false, cancellationsSpent};
  }
  return {blocked: true, cancellationsSpent: cancellationsSpent + 1};
}
