import type {MatchResult} from '../../../shared/protocols';
import type {AccountStore} from '../account-store';
import {randomUUID} from 'node:crypto';

export interface CommittedMatch {
  roomId: string;
  mode: number;
  mapId: number;
  result: MatchResult;
  participants: {playerId: string; connectionId: string; cpu: boolean}[];
}

/** Capture identities at the synchronous finish boundary, before disconnect
 * removes the session. Failed writes retain the frozen payload for retry. */
export function accountMatchHistory(store: AccountStore,
  accounts: ReadonlyMap<string, string>, report: (error: unknown) => void = console.error) {
  const runId = randomUUID();
  const pending = new Map<string, {match: {matchId: string; round: number; mode: number;
    mapId: number; endedAt: number; reason: MatchResult['reason']};
    participants: {accountId: string; result: MatchResult['players'][number]}[]}>();
  const reported = new Set<string>();
  const flush = (): void => {
    for (const [key, payload] of pending) {
      try {
        store.recordMatchHistory(payload.match, payload.participants);
        pending.delete(key);
        reported.delete(key);
      } catch (error) {
        if (!reported.has(key)) {reported.add(key); report(error);}
      }
    }
  };
  return {
    committed(match: CommittedMatch): void {
      const matchId = `${runId}:${match.roomId}`;
      const key = `${matchId}:${match.result.round}`;
      if (pending.has(key)) {flush(); return;}
      const participants = match.participants.flatMap(participant => {
        const accountId = participant.cpu ? undefined : accounts.get(participant.connectionId);
        const result = match.result.players.find(player => player.id === participant.playerId);
        return accountId && result ? [{accountId, result: {...result}}] : [];
      });
      if (!participants.length) return;
      pending.set(key, {match: {matchId, round: match.result.round,
        mode: match.mode, mapId: match.mapId, endedAt: match.result.endedAt, reason: match.result.reason}, participants});
      flush();
    },
    flush,
    get pendingCount(): number {return pending.size;},
  };
}
