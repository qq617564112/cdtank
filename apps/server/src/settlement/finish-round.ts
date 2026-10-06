import type {MatchResult, MsgPlayerInput} from '../../../shared/protocols';
import type {BulletState} from '../battle/projectiles';
import type {ModeMapConfig} from '../config';
import {computeMatchResult, type MatchResultInput} from './match-result';
import {computeRoundAwards, type AwardParticipant} from './awards';

interface FinishingRoom {
  phase: 'WAITING' | 'LOADING' | 'PLAYING' | 'FINISHED';
  players: ReadonlyMap<string, MatchResultInput['players'][number] & {input: MsgPlayerInput}>;
  departedParticipants?: ReadonlyMap<string, MatchResultInput['players'][number] & {playedSeconds?: number}>;
  mode: number;
  map: ModeMapConfig;
  teamLives: number[];
  teamScores: number[];
  round: number;
  startedAt: number;
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
  const departedPlayers = [...room.departedParticipants?.values() ?? []];
  const result = computeMatchResult({players, departedPlayers, mode: room.mode, bonuses: room.map,
    teamLives: room.teamLives, teamScores: room.teamScores, round: room.round,
    endedAt: now, reason, winnerTeam, winnerPlayerId});
  const elapsedSeconds = Math.max(0, (now - room.startedAt) / 1000);
  const participants: AwardParticipant[] = result.players.flatMap(player => {
    const departed = room.departedParticipants?.get(player.id);
    const playedSeconds = departed?.playedSeconds !== undefined ? departed.playedSeconds : elapsedSeconds;
    if (!player.roundStats) return [];
    return [{
      playerId: player.id,
      team: player.team,
      playedSeconds,
      roundStats: player.roundStats,
      kills: player.kills,
      deaths: player.deaths,
      objectivesDestroyed: player.objectivesDestroyed,
      combatScore: player.combatScore,
      outcomeBonus: player.outcomeBonus,
      totalScore: player.combatScore + player.outcomeBonus,
    }];
  });
  const awards = computeRoundAwards(room.map, participants);
  for (const player of result.players) {
    if (!player.roundStats) continue;
    const playerAwards = awards.get(player.id) ?? [];
    const score = playerAwards.reduce((total, award) => total + award.score, 0);
    player.combatScore += score;
    player.totalScore += score;
    player.awards = playerAwards.map(award => ({...award}));
  }
  room.phase = 'FINISHED';
  room.endedAt = now;
  room.winnerTeam = result.winnerTeam;
  room.bullets = [];
  players.forEach(player => {player.input = {...defaultInput};});
  room.result = result;
  return true;
}
