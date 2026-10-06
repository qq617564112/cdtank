export type PetLearningQuote = {
  instanceId: number;
  petId: number;
  slot: number;
  baseId: number;
  rank: number;
  rankCap: number;
} & (
  | {kind: 'rankLimit'; originalFeedback: 0}
  | {kind: 'insufficientPoints'; originalFeedback: 2; nextSkillId: number; cost: number}
  | {kind: 'eligible'; nextSkillId: number; cost: number; nextRank: number; remainingPoints: number}
);

