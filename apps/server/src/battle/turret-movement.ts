import {originalMovementParameters, type MovingParticipant} from './movement';
import {aimTurnRate} from './roles/aim-turn';
import {roleMovementElapsed} from './roles/movement-time';
import {hasFixedTurret} from '../../../shared/combat/tank-turret';

interface AimingParticipant extends MovingParticipant {aim: number;}

/** Fixed mounts follow the hull; other turrets accept independent split-key aim. */
export function advanceBattleTurret(player: AimingParticipant, inputAim: number, seconds: number): void {
  if (hasFixedTurret(player.tank.id)) {
    const aim = (player.bodyYaw ?? player.yaw) - player.yaw;
    player.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
    return;
  }
  const dt = roleMovementElapsed(seconds);
  if (inputAim === 0 || dt === 0) return;
  const parameters = originalMovementParameters(player);
  const turn = aimTurnRate(parameters?.turn, player.tank.turn);
  const angle = Math.fround(Math.fround(turn * inputAim) * dt);
  const aim = player.aim + angle;
  player.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
}
