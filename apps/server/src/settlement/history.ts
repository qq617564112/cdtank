import type {MatchResult} from '../../../shared/protocols';
import type {ResultAward} from '../../../shared/protocols/MsgRoomSnapshot';
import type {AccountStore} from '../account-store';
import {randomUUID} from 'node:crypto';

export interface CommittedMatch {
  roomId: string;
  mode: number;
  mapId: number;
  result: MatchResult;
  /** Departed participants carry the already-resolved `accountId` captured before removal.
   * `elapsedSeconds` is the real frozen PLAYING duration for that participant (full round for
   * participants present at finish, leave time for mid-round departures, absent when uncaptured).
   */
  participants: {playerId: string; connectionId: string; cpu: boolean; accountId?: string;
    elapsedSeconds?: number}[];
}

interface PendingPayload {
  match: {matchId: string; roomId: string; round: number; mode: number; mapId: number;
    endedAt: number; reason: MatchResult['reason']};
  participants: {accountId: string; result: MatchResult['players'][number];
    playerIds: string[]; elapsedSeconds?: number}[]};

/** Receipts for a payload that just committed; World publishes these on the still-live room. */
export interface CommittedReceipt {
  roomId: string;
  round: number;
  awards: ReadonlyMap<string, ResultAward>;
}

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
  const receipts = (payload: PendingPayload): Map<string, ResultAward> => {
    const byPlayer = new Map<string, ResultAward>();
    for (const participant of payload.participants) {
      const award = store.rewardReceipt(participant.accountId, payload.match.matchId, payload.match.round);
      if (!award) continue;
      for (const playerId of participant.playerIds) byPlayer.set(playerId, award);
    }
    return byPlayer;
  };
  /** Retry failed payloads; a successful retry returns its receipt so World can late-attach award. */
  const flush = (): CommittedReceipt[] => {
    const committed: CommittedReceipt[] = [];
    for (const [key, payload] of pending) {
      try {
        commit(payload);
        pending.delete(key);
        reported.delete(key);
        committed.push({roomId: payload.match.roomId, round: payload.match.round, awards: receipts(payload)});
      } catch (error) {
        if (!reported.has(key)) {reported.add(key); report(error);}
      }
    }
    return committed;
  };
  return {
    committed(match: CommittedMatch): ReadonlyMap<string, ResultAward> {
      const matchId = `${runId}:${match.roomId}`;
      const key = `${matchId}:${match.result.round}`;
      if (pending.has(key)) {
        const retried = flush().find(receipt => receipt.roomId === match.roomId
          && receipt.round === match.result.round);
        return retried?.awards ?? NO_AWARDS;
      }
      // One account settles once per round even with two participant connections; keep the
      // longest real captured duration so a second connection cannot shorten or double-count it.
      const byAccount = new Map<string, {playerIds: string[]; result: MatchResult['players'][number];
        elapsedSeconds?: number}>();
      for (const participant of match.participants) {
        const accountId = participant.accountId
          ?? (participant.cpu ? undefined : accounts.get(participant.connectionId));
        const result = match.result.players.find(player => player.id === participant.playerId);
        if (!accountId || !result) continue;
        const existing = byAccount.get(accountId);
        if (existing) {
          existing.playerIds.push(result.id);
          if (participant.elapsedSeconds !== undefined
              && (existing.elapsedSeconds === undefined
                || participant.elapsedSeconds > existing.elapsedSeconds)) {
            existing.elapsedSeconds = participant.elapsedSeconds;
          }
        } else {
          byAccount.set(accountId, {playerIds: [result.id], result: {...result},
            elapsedSeconds: participant.elapsedSeconds});
        }
      }
      if (!byAccount.size) return NO_AWARDS;
      const payload: PendingPayload = {match: {matchId, roomId: match.roomId, round: match.result.round,
        mode: match.mode, mapId: match.mapId, endedAt: match.result.endedAt, reason: match.result.reason},
        participants: [...byAccount].map(([accountId, entry]) =>
          ({accountId, result: entry.result, playerIds: entry.playerIds,
            elapsedSeconds: entry.elapsedSeconds}))};
      try {
        commit(payload);
      } catch (error) {
        pending.set(key, payload);
        if (!reported.has(key)) {reported.add(key); report(error);}
        return NO_AWARDS;
      }
      return receipts(payload);
    },
    flush,
    get pendingCount(): number {return pending.size;},
  };
}
