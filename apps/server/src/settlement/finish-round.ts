import type {MatchResult, MsgPlayerInput} from '../../../shared/protocols';
import type {BulletState} from '../battle/projectiles';
import {computeMatchResult, type MatchResultInput} from './match-result';

interface FinishingRoom {
  phase: 'WAITING' | 'PLAYING' | 'FINISHED';
  players: ReadonlyMap<string, MatchResultInput['players'][number] & {input: MsgPlayerInput}>;
  mode: number;
  map: MatchResultInput['bonuses'];
  teamLives: number[];
  teamScores: number[];
  round: number;
  endedAt: number;
  winnerTeam: number;
  bullets: BulletState[];
  result?: MatchResult;
}

/** Commit once, synchronously: the current projectile loop must see FINISHED. */
export function finishRound(room: FinishingRoom, now: number, reason: MatchResult['reason'],
  defaultInput: MsgPlayerInput, winnerTeam?: number, winnerPlayerId?: string): boolean {
  if (room.phase !== 'PLAYING') return false;
  const players = [...room.players.values()];
  const result = computeMatchResult({players, mode: room.mode, bonuses: room.map,
    teamLives: room.teamLives, teamScores: room.teamScores, round: room.round,
    endedAt: now, reason, winnerTeam, winnerPlayerId});
  room.phase = 'FINISHED';
  room.endedAt = now;
  room.winnerTeam = result.winnerTeam;
  room.bullets = [];
  players.forEach(player => {player.input = {...defaultInput};});
  room.result = result;
  return true;
}
