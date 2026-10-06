import type {MsgPlayerInput} from '../../../../shared/protocols';
import type {Battlefield, Point} from '../../battlefield';
import type {BotActor} from './controller';

/** Rebuilt VIP survival chooses only an ordinary step away from live enemies. */
export function vipEvasion(actor: BotActor, enemies: readonly BotActor[], bearing: number,
  input: MsgPlayerInput, field: Battlefield, dt: number): {move: number; turn: number} | undefined {
  const nearest = (point: Point) => Math.min(...enemies.map(enemy => Math.hypot(enemy.x - point.x, enemy.z - point.z)));
  let best = nearest(actor), retreat = 0;
  const bodyError = Math.atan2(Math.sin(bearing - actor.yaw), Math.cos(bearing - actor.yaw));
  const turn = Math.max(-1, Math.min(1, bodyError / ((actor.movement?.turn ?? actor.tank.turn * .12) * Math.max(dt, .001))));
  for (const move of [-1, 1]) {
    const command = {...input, move, turn};
    const yaw = actor.yaw + turn * actor.tank.turn * .12 * dt;
    const candidate = actor.movement?.predict(command) ?? field.move(actor, {
      x: actor.x + Math.sin(yaw) * move * actor.tank.speed * 6 * dt,
      y: actor.y, z: actor.z + Math.cos(yaw) * move * actor.tank.speed * 6 * dt,
    }, 20);
    const separation = nearest(candidate);
    if (separation > best + .05) {retreat = move; best = separation;}
  }
  return retreat ? {move: retreat, turn} : undefined;
}
