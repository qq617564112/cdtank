import type {OwnedTankTextures} from '../combat/role-owned-textures';
import type {RoleTankTextureConfirmation} from '../contracts/tank-textures';
import type {ResOwnedRoles} from './PtlOwnedRoles';

/** Rebuilt authority endpoint using recovered instance and three source table IDs. */
export interface ReqTankTextures {
  instanceId: number;
  textures: OwnedTankTextures;
}

export interface ResTankTextures {
  confirmation: RoleTankTextureConfirmation;
  owned: ResOwnedRoles;
  profile: {bytes: number[]; strings: [string, string]};
}
