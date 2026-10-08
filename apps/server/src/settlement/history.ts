import type {MatchResult} from '../../../shared/protocols';
import type {ResultAward} from '../../../shared/protocols/MsgRoomSnapshot';
import type {AccountStore} from '../account-store';
import {mergeResultRewardModifiers} from './reward-modifiers';
import type {ResultRewardModifiers} from './reward-modifiers';
import type {EquipmentRewardRoll} from '../accounts/equipment-reward';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import {randomUUID} from 'node:crypto';

/** Rebuilt battle-equipment eligibility: a completed, non-forfeit round of at least 60s with score. */
const BATTLE_EQUIPMENT_MIN_SECONDS = 60;

export interface CommittedMatch {
  roomId: string;
  mode: number;
  mapId: number;
  result: MatchResult;
  /** Departed participants carry the already-resolved `accountId` captured before removal.
   * `elapsedSeconds` is the real frozen PLAYING duration for that participant (full round for
   * participants present at finish, leave time for mid-round departures, absent when uncaptured).
   * `rewardModifiers` is the participant's real Func19 selection frozen at the finish boundary and
   * carried into the pending payload; it never enters the public history record.
   */
  participants: {playerId: string; connectionId: string; cpu: boolean; accountId?: string;
    elapsedSeconds?: number; rewardModifiers?: ResultRewardModifiers; completedRound?: boolean}[];
}

interface PendingPayload {
  match: {matchId: string; roomId: string; round: number; mode: number; mapId: number;
    endedAt: number; reason: MatchResult['reason']};
  participants: {accountId: string; result: MatchResult['players'][number];
    playerIds: string[]; elapsedSeconds?: number; rewardModifiers?: ResultRewardModifiers;
    equipmentRewardRoll?: EquipmentRewardRoll}[]};

/** Four Math.random results in [0,1) for the frozen item/tank chance and selection. */
function drawEquipmentRoll(): EquipmentRewardRoll {
  return {itemChance: Math.random(), itemChoice: Math.random(),
    tankChance: Math.random(), tankChoice: Math.random()};
}

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
  accounts: ReadonlyMap<string, string>, report: (error: unknown) => void = console.error,
  inventoryGranted?: (accountId: string, records: readonly InventoryWireRecord[]) => void) {
  const runId = randomUUID();
  const pending = new Map<string, PendingPayload>();
  const reported = new Set<string>();
  const commit = (payload: PendingPayload): void => {
    // Award persistence shares the settled-match/history transaction; a thrown
    // grant rolls the whole match back and leaves no fake success.
    const modifiersByAccount = new Map(payload.participants.map(participant =>
      [participant.accountId, participant.rewardModifiers]));
    const rollByAccount = new Map(payload.participants.map(participant =>
      [participant.accountId, participant.equipmentRewardRoll]));
    store.recordMatchHistory(payload.match, payload.participants,
      (accountId, result) => {
        const rewardModifiers = modifiersByAccount.get(accountId);
        const equipmentRewardRoll = rollByAccount.get(accountId);
        // Hand the frozen multiplier to the reward transaction on a private copy; the persisted
        // history record spreads `result` without it, so the public MatchHistoryRecord stays clean.
        const carried = {...result,
          ...(rewardModifiers ? {rewardModifiers} : {}),
          ...(equipmentRewardRoll ? {equipmentRewardRoll} : {})};
        return store.grantMatchReward(accountId, payload.match.matchId, payload.match.round, carried);
      });
  };
  const receipts = (payload: PendingPayload): Map<string, ResultAward> => {
    const byPlayer = new Map<string, ResultAward>();
    for (const participant of payload.participants) {
      const award = store.rewardReceipt(participant.accountId, payload.match.matchId, payload.match.round);
      if (!award) continue;
      if (inventoryGranted && award.grantedItems?.length) {
        const instanceIds = new Set(award.grantedItems.map(item => item.instanceId));
        inventoryGranted(participant.accountId,
          store.inventory(participant.accountId).records.filter(record => instanceIds.has(record.instanceId)));
      }
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
      // Equipment eligibility is evaluated on each participant before merging the account.
      const byAccount = new Map<string, {playerIds: string[]; result: MatchResult['players'][number];
        elapsedSeconds?: number; rewardModifiers?: ResultRewardModifiers; equipmentEligible: boolean}>();
      for (const participant of match.participants) {
        const accountId = participant.accountId
          ?? (participant.cpu ? undefined : accounts.get(participant.connectionId));
        const result = match.result.players.find(player => player.id === participant.playerId);
        if (!accountId || !result) continue;
        const equipmentEligible = !participant.cpu && match.result.reason !== 'FORFEIT'
          && participant.completedRound === true
          && (participant.elapsedSeconds ?? 0) >= BATTLE_EQUIPMENT_MIN_SECONDS
          && result.combatScore > 0;
        const existing = byAccount.get(accountId);
        if (existing) {
          existing.playerIds.push(result.id);
          existing.rewardModifiers = mergeResultRewardModifiers(
            [existing.rewardModifiers, participant.rewardModifiers]);
          existing.equipmentEligible ||= equipmentEligible;
          if (participant.elapsedSeconds !== undefined
              && (existing.elapsedSeconds === undefined
                || participant.elapsedSeconds > existing.elapsedSeconds)) {
            existing.elapsedSeconds = participant.elapsedSeconds;
          }
        } else {
          byAccount.set(accountId, {playerIds: [result.id], result: {...result},
            elapsedSeconds: participant.elapsedSeconds, rewardModifiers: participant.rewardModifiers,
            equipmentEligible});
        }
      }
      if (!byAccount.size) return NO_AWARDS;
      const payload: PendingPayload = {match: {matchId, roomId: match.roomId, round: match.result.round,
        mode: match.mode, mapId: match.mapId, endedAt: match.result.endedAt, reason: match.result.reason},
        participants: [...byAccount].map(([accountId, entry]) => {
          return {accountId, result: entry.result, playerIds: entry.playerIds,
            elapsedSeconds: entry.elapsedSeconds, rewardModifiers: entry.rewardModifiers,
            ...(entry.equipmentEligible ? {equipmentRewardRoll: drawEquipmentRoll()} : {})};
        })};
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
