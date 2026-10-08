import {rankedPetSkillId} from '../content/catalog';
import type {OwnedRoleBaseRecord} from '../contracts/owned-base';

export interface PetLearningDefinition {
  petId: number;
  baseIds: readonly number[];
  rankCaps: readonly number[];
}

export interface PetLearningPrice {
  skillId: number;
  groupId: number;
  level: number;
  cost: number;
}

import type {PetLearningQuote} from '../contracts/pet-learning';
export type {PetLearningQuote} from '../contracts/pet-learning';

/** Original49380b eligibility and next-level price; account authorization stays at the boundary. */
export function quotePetSkillLearning(input: {
  owned: OwnedRoleBaseRecord | undefined;
  definition: PetLearningDefinition | undefined;
  prices: ReadonlyMap<number, PetLearningPrice>;
  slot: number;
  points: number | undefined;
}): PetLearningQuote | undefined {
  const {owned, definition, prices, slot, points} = input;
  if (!owned || !definition || points === undefined || !Number.isInteger(slot) || slot < 0 || slot >= 6) return undefined;
  const instanceId = owned.fields.get(0), petId = owned.fields.get(8);
  const baseId = owned.fields.get(0x44 + slot * 4), rankValue = owned.fields.get(0x5c + slot * 4);
  const capValue = definition.rankCaps[slot];
  if (instanceId === undefined || petId !== definition.petId || baseId === undefined ||
      rankValue === undefined || capValue === undefined) return undefined;
  const rank = rankValue | 0, rankCap = capValue | 0;
  const common = {instanceId: instanceId >>> 0, petId, slot, baseId: baseId >>> 0, rank, rankCap};
  const nextSkillId = rankedPetSkillId(baseId, rank + 1) ?? 0;
  const price = prices.get(nextSkillId);
  // The original sender resolves the next record before comparing the rank cap.
  if (!price) return undefined;
  if (rank >= rankCap) return {...common, kind: 'rankLimit', originalFeedback: 0};
  const cost = price.cost >>> 0;
  if ((points >>> 0) < cost) return {...common, kind: 'insufficientPoints', originalFeedback: 2, nextSkillId, cost};
  return {...common, kind: 'eligible', nextSkillId, cost, nextRank: (rank + 1) | 0,
    remainingPoints: ((points >>> 0) - cost) >>> 0};
}
