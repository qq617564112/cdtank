import type {DatabaseSync} from 'node:sqlite';
import type {AccountGrowth} from '../../../shared/protocols/MsgRoomSnapshot';
import type {ResRoleProfile} from '../../../shared/protocols/PtlRoleProfile';
import type {RoleProfilePayload} from './profile/payload';
import {readRoleProfilePlayerSummary} from './profile/player-summary';

/** Typed growth only; a missing row stays unknown instead of taking AccountReward's default. */
export function readPersistedAccountGrowth(database: DatabaseSync, accountId: string): AccountGrowth | undefined {
  const row = database.prepare(`SELECT rank_points, level, originality, skill_points
    FROM account_growth WHERE account_id = ?`).get(accountId);
  if (!row) return undefined;
  return {rankPoints: Number(row.rank_points), level: Number(row.level),
    originality: Number(row.originality), tech: Number(row.skill_points)};
}

/** Existing signed player summary from an already-persisted original profile. */
export function readPersistedPlayerSummary(database: DatabaseSync, accountId: string):
  NonNullable<ResRoleProfile['playerSummary']> | undefined {
  const row = database.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);
  if (!row) return undefined;
  const profile: RoleProfilePayload = {bytes: new Uint8Array(row.payload as Uint8Array),
    strings: JSON.parse(String(row.strings)) as [string, string]};
  return readRoleProfilePlayerSummary(profile);
}
