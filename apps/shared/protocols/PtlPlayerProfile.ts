import type {PlayerTitle} from './MsgRoomSnapshot';
import type {AccountStatistics, AwardCounts} from './PtlRoleProfile';
import type {OwnedTankTextures} from '../combat/role-owned-textures';

/** Narrow public target profile query; absent fields remain unknown. */
export interface ReqPlayerProfile {
  targetAccountId: string;
}

export interface ResPlayerProfile {
  accountId: string;
  name: string;
  level?: number;
  score?: number;
  originality?: number;
  tech?: number;
  title?: PlayerTitle;
  statistics?: AccountStatistics;
  awards?: AwardCounts;
  family?: {
    id: string;
    name: string;
  };
  /** Selected target models and appearance, resolved from persisted owned roles. */
  models?: {
    tankId: number;
    petId: number;
    textures?: OwnedTankTextures;
  };
}
