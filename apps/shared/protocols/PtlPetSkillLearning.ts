import type {PetLearningQuote} from '../contracts/pet-learning';
import type {ResOwnedRoles} from './PtlOwnedRoles';

export interface ReqPetSkillLearning {
  operation: 'QUERY' | 'LEARN' | 'CONFIRM';
  instanceId?: number;
  slot?: number;
  requestId?: string;
}

export interface ResPetSkillLearning {
  points?: number;
  quotes: PetLearningQuote[];
  owned: ResOwnedRoles;
  profile?: {bytes: number[]; strings: [string, string]};
  learned?: {instanceId: number; slot: number; skillId: number; rank: number; cost: number};
  confirmation?: 'APPLIED' | 'ABSENT';
  replayed?: boolean;
}
