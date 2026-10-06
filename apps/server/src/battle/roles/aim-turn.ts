/** Original selector11 supplies the split-key turret turn rate.
 * Incomplete attribute sources retain the prototype body turn rate.
 */
export function aimTurnRate(roleTurn: number | undefined, tankTurn: number): number {
  return roleTurn ?? tankTurn * .12;
}
