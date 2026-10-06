/** Rebuilt keyboard mapping: independent turret input uses the recovered role
 * turn rate. Incomplete sources retain the existing prototype body turn rate.
 * The original independent turret controller has not been recovered.
 */
export function aimTurnRate(roleTurn: number | undefined, tankTurn: number): number {
  return roleTurn ?? tankTurn * .12;
}
