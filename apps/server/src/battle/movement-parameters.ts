/** Final movement calibration, applied after role attributes and item effects. */
export const TANK_MOVEMENT_ADJUSTMENT = 0.7;

export function adjustedMovementParameters(speed: number, turn: number): {speed: number; turn: number} {
  return {speed: speed * TANK_MOVEMENT_ADJUSTMENT, turn: turn * TANK_MOVEMENT_ADJUSTMENT};
}

export function defaultMovementParameters(tank: {speed: number; turn: number}, moveScale = 6):
    {speed: number; turn: number} {
  return adjustedMovementParameters(tank.speed * moveScale, tank.turn * .12);
}
