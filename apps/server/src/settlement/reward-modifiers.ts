import {content} from '../content';
import type {CombatSkillDefinition} from '../../../shared/combat/catalog';
import type {ResultPlayer} from '../../../shared/protocols/MsgRoomSnapshot';
import {combatSkills} from '../battle/catalog';

/** Func19 end-of-round reward percentages frozen with the pending settlement payload. */
export interface ResultRewardModifiers {
  moneyPercent: number;
  originalityPercent: number;
  techPercent: number;
}

/** Frozen result carried inside history/account transactions; never part of the shared protocol. */
export type FrozenRewardResult = ResultPlayer & {rewardModifiers?: ResultRewardModifiers};

/** Func19 is a trigger0/Target1 passive function in the source skill table. */
const FUNC19_TYPE = 19;
const FUNC19_TRIGGER = 0;
const FUNC19_TARGET = 1;

const MODIFIER_FIELDS: readonly (keyof ResultRewardModifiers)[] =
  ['moneyPercent', 'originalityPercent', 'techPercent'];

/** Read one Func19 skill's frozen percentage; undefined when the definition is not a real Func19 source. */
function readFunc19Percent(skill: CombatSkillDefinition | undefined,
    param: 'x' | 'y' | 'z'): number | undefined {
  if (!skill || skill.triggerType !== FUNC19_TRIGGER || skill.target !== FUNC19_TARGET) return undefined;
  const fn = skill.functions.find(entry => entry.type === FUNC19_TYPE);
  if (!fn) return undefined;
  const percent = fn[param];
  return Number.isFinite(percent) && percent >= 0 ? percent : undefined;
}

/** Frozen skills 12501/02/03 from the selected skill list; the highest non-negative value per type once.
 * Only ids already selected by `selectRoleSkills` are accepted; the global catalog never grants a source.
 */
export function readResultRewardModifiers(skillIds: readonly number[]): ResultRewardModifiers {
  const result: ResultRewardModifiers = {moneyPercent: 0, originalityPercent: 0, techPercent: 0};
  const seen = new Set<number>();
  for (const skillId of skillIds) {
    if (seen.has(skillId)) continue;
    seen.add(skillId);
    const source = content.skills.get(skillId)?.runtime.rewardModifier;
    if (!source) continue;
    const percent = readFunc19Percent(combatSkills.get(skillId), source.param);
    if (percent !== undefined && percent > result[source.field]) result[source.field] = percent;
  }
  return result;
}

/** Highest non-negative per type across frozen sources; same skill never stacks.
 * Undefined sources are ignored, so an account with no Func19 selection keeps the original zero multiplier.
 */
export function mergeResultRewardModifiers(sources: readonly (ResultRewardModifiers | undefined)[]):
    ResultRewardModifiers | undefined {
  let merged: ResultRewardModifiers | undefined;
  for (const source of sources) {
    if (!source) continue;
    for (const field of MODIFIER_FIELDS) {
      const value = source[field];
      if (!Number.isFinite(value) || value < 0) continue;
      merged ??= {moneyPercent: 0, originalityPercent: 0, techPercent: 0};
      if (value > merged[field]) merged[field] = value;
    }
  }
  return merged;
}
