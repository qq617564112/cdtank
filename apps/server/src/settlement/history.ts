import type {MatchResult} from '../../../shared/protocols';
import type {ResultAward} from '../../../shared/protocols/MsgRoomSnapshot';
import type {AccountStore} from '../account-store';
import {randomUUID} from 'node:crypto';

export interface CommittedMatch {
  roomId: string;
  mode: number;
  mapId: number;
  result: MatchResult;
  participants: {playerId: string; connectionId: string; cpu: boolean}[];
}

interface PendingPayload {
  match: {matchId: string; round: number; mode: number; mapId: number;
    endedAt: number; reason: MatchResult['reason']};
  participants: {accountId: string; result: MatchResult['players'][number]}[]};

/** Empty award set; participants without a committed receipt keep an absent snapshot award. */
const NO_AWARDS: ReadonlyMap<string, ResultAward> = new Map();

/** Capture identities at the synchronous finish boundary, before disconnect
 * removes the session. Failed writes retain the frozen payload for retry.
 * A successful or replayed commit returns the authoritative per-player receipt,
 * keyed by frozen playerId, and annotates the frozen result it was handed.
 */
export function accountMatchHistory(store: AccountStore,
  accounts: ReadonlyMap<string, string>, report: (error: unknown) => void = console.error) {
  const runId = randomUUID();
  const pending = new Map<string, PendingPayload>();
  const reported = new Set<string>();
  const commit = (payload: PendingPayload): void => {
    // Award persistence shares the settled-match/history transaction; a thrown
    // grant rolls the whole match back and leaves no fake success.
    store.recordMatchHistory(payload.match, payload.participants,
      (accountId, result) => store.grantMatchReward(accountId, payload.match.matchId, payload.match.round, result));
  };
  const flush = (): void => {
    for (const [key, payload] of pending) {
      try {
        commit(payload);
        pending.delete(key);
        reported.delete(key);
      } catch (error) {
        if (!reported.has(key)) {reported.add(key); report(error);}
      }
    }
  };
  return {
    committed(match: CommittedMatch): ReadonlyMap<string, ResultAward> {
      const matchId = `${runId}:${match.roomId}`;
      const key = `${matchId}:${match.result.round}`;
      if (pending.has(key)) {flush(); return NO_AWARDS;}
      // One account settles once per round even with two participant connections.
      const byAccount = new Map<string, {playerIds: string[]; result: MatchResult['players'][number]}>();
      for (const participant of match.participants) {
        const accountId = participant.cpu ? undefined : accounts.get(participant.connectionId);
        const result = match.result.players.find(player => player.id === participant.playerId);
        if (!accountId || !result) continue;
        const existing = byAccount.get(accountId);
        if (existing) existing.playerIds.push(result.id);
        else byAccount.set(accountId, {playerIds: [result.id], result: {...result}});
      }
      if (!byAccount.size) return NO_AWARDS;
      const payload: PendingPayload = {match: {matchId, round: match.result.round,
        mode: match.mode, mapId: match.mapId, endedAt: match.result.endedAt, reason: match.result.reason},
        participants: [...byAccount].map(([accountId, entry]) => ({accountId, result: entry.result}))};
      try {
        commit(payload);
      } catch (error) {
        pending.set(key, payload);
        if (!reported.has(key)) {reported.add(key); report(error);}
        return NO_AWARDS;
      }
      const byPlayer = new Map<string, ResultAward>();
      for (const [accountId, entry] of byAccount) {
        const award = store.rewardReceipt(accountId, matchId, match.result.round);
        if (!award) continue;
        for (const playerId of entry.playerIds) byPlayer.set(playerId, award);
      }
      return byPlayer;
    },
    flush,
    get pendingCount(): number {return pending.size;},
  };
}
