import type {MsgPlayerInput} from '../../../shared/protocols';
import type {PlayerState} from './player-state';
import {BotController} from './cpu/controller';

/** World verifies current membership and round before changing control. */
export function configureBattleAutopilot(room: {phase: string; ready: Set<string>},
  player: PlayerState, enabled: boolean, defaultInput: MsgPlayerInput): void {
  if (player.cpu) throw new Error('当前对局无法设置AI托管');
  if (!!player.autopilot === enabled) return;
  player.autopilot = enabled ? new BotController() : undefined;
  player.autopilotInputSequence = 0;
  player.input = {...defaultInput};
  if (room.phase === 'WAITING') room.ready.delete(player.id);
}
