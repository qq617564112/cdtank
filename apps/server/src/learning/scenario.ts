import {initialTankVerticalState} from '../../../shared/movement/tank-vertical';
import {overlapsTankPose, tankBodyPose, tankObstacles} from '../../../shared/movement/tank-collision';
import {sampleRoleNavigationFailure} from '../battle/roles/movement-navigation';
import {ORIGINAL_MOVEMENT_DIMENSIONS} from '../battle/movement';
import {clearRespawnProtection} from '../battle/respawn-protection';
import {setBattleHealth} from '../battle/health';
import type {PlayerState} from '../battle/player-state';
import type {RoomState} from '../rooms/state';

export interface LearningPlacement {
  x: number;
  z: number;
  yaw: number;
  aim?: number;
  hp?: number;
}

/** Initial conditions for offline lessons; subsequent actions use ordinary World inputs. */
export function placeLearningActor(room: RoomState, player: PlayerState,
  placement: LearningPlacement, maximumHp: number): boolean {
  if (!room.battlefield.navigation.isValidAt(placement.x, placement.z)) return false;
  const y = room.battlefield.navigation.groundHeightAt(placement.x, placement.z);
  if (y === undefined) return false;
  const candidate = {...placement, id: player.id, alive: true, y, bodyYaw: placement.yaw};
  const forward = {x: Math.fround(Math.sin(placement.yaw)), y: 0, z: Math.fround(Math.cos(placement.yaw))};
  if (sampleRoleNavigationFailure(room.battlefield.navigation, candidate, forward, 1,
      ORIGINAL_MOVEMENT_DIMENSIONS.width, ORIGINAL_MOVEMENT_DIMENSIONS.depth) !== undefined
      || overlapsTankPose(tankBodyPose(candidate), tankObstacles(player.id, room.players.values()))) return false;
  Object.assign(player, {x: placement.x, y, z: placement.z,
    yaw: placement.yaw, bodyYaw: placement.yaw, aim: placement.aim ?? 0});
  player.movementState = undefined;
  player.verticalState = initialTankVerticalState(y, y);
  player.movementCommand = 0;
  clearRespawnProtection(player);
  if (placement.hp !== undefined) setBattleHealth(player, placement.hp, maximumHp);
  return true;
}
