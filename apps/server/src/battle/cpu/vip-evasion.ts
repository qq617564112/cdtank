import type {MsgPlayerInput} from '../../../../shared/protocols';
import type {Battlefield, Point} from '../../battlefield';
import type {BotActor} from './controller';
import {defaultMovementParameters} from '../movement-parameters';

/** Rebuilt VIP survival chooses only an ordinary step away from live enemies. */
export function vipEvasion(actor: BotActor, enemies: readonly BotActor[], bearing: number,
  input: MsgPlayerInput, field: Battlefield, dt: number): {move: number; turn: number} | undefined {
  const nearest = (point: Point) => Math.min(...enemies.map(enemy => Math.hypot(enemy.x - point.x, enemy.z - point.z)));
  let best = nearest(actor), retreat = 0;
  const bodyError = Math.atan2(Math.sin(bearing - actor.yaw), Math.cos(bearing - actor.yaw));
  const parameters = actor.movement ?? defaultMovementParameters(actor.tank);
  const turn = Math.max(-1, Math.min(1, bodyError / (parameters.turn * Math.max(dt, .001))));
  for (const move of [-1, 1]) {
    const command = {...input, move, turn};
    const yaw = actor.yaw + turn * parameters.turn * dt;
    const candidate = actor.movement?.predict(command) ?? field.move(actor, {
      x: actor.x + Math.sin(yaw) * move * parameters.speed * dt,
      y: actor.y, z: actor.z + Math.cos(yaw) * move * parameters.speed * dt,
    }, 20);
    const separation = nearest(candidate);
    if (separation > best + .05) {retreat = move; best = separation;}
  }
  return retreat ? {move: retreat, turn} : undefined;
}
