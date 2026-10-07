import {combatItems} from '../catalog';

export const TEAM_FEED_ITEM_ID = 3006;

export interface TeamFeedRule {
  itemTableId: typeof TEAM_FEED_ITEM_ID;
  placementSkillId: number;
  groundModelId: number;
  groundDurationMs: number;
  triggerRadius: number;
  healAmount: number;
}

/** Exact 3006 web-adopted ground team-heal route; the unresolved primary skill is metadata only. */
export function readTeamFeedRule(itemTableId = TEAM_FEED_ITEM_ID): TeamFeedRule | undefined {
  if (itemTableId !== TEAM_FEED_ITEM_ID) return undefined;
  const item = combatItems.get(itemTableId);
  const roles = item?.runtime.skillRoles;
  if (!item || item.category !== 4 || item.itemType !== 4 || item.runtime.trap !== 'teamHeal'
      || item.resources.modelId !== 9 || roles?.primary !== 4027) return undefined;
  const groundDurationMs = item.runtime.values.groundDurationMs;
  const triggerRadius = item.runtime.values.triggerRadius;
  const healAmount = item.runtime.values.healAmount;
  if (!Number.isFinite(groundDurationMs) || groundDurationMs <= 0
      || !Number.isFinite(triggerRadius) || triggerRadius <= 0
      || !Number.isFinite(healAmount) || healAmount <= 0) return undefined;
  return {itemTableId, placementSkillId: roles.primary, groundModelId: item.resources.modelId,
    groundDurationMs, triggerRadius, healAmount};
}
