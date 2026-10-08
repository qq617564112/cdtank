import type {MsgPlayerInput} from '../../../shared/protocols';
import type {PlayerState} from './player-state';
import {BotController} from './cpu/controller';
import type {Battlefield} from '../battlefield';
import {initialTankVerticalState} from '../../../shared/movement/tank-vertical';

/** World verifies current membership and round before changing control. */
export function configureBattleAutopilot(room: {phase: string; ready: Set<string>; battlefield: Battlefield},
  player: PlayerState, enabled: boolean, defaultInput: MsgPlayerInput): void {
  if (player.cpu) throw new Error('当前对局无法设置AI托管');
  if (!!player.autopilot === enabled) return;
  player.autopilot = enabled ? new BotController() : undefined;
  player.autopilotInputSequence = 0;
  player.input = {...defaultInput};
  // Control changes discard the previous driver's vertical state; rebuild the
  // fall/ground state from the body's current Y and the real NAV surface so a
  // leftover descent velocity cannot carry across the switch.
  player.verticalState = initialTankVerticalState(player.y,
    room.battlefield.navigation.sample(player.x, player.z)?.height);
  if (room.phase === 'WAITING') room.ready.delete(player.id);
}
