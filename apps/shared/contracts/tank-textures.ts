import type {OwnedTankTextures} from '../combat/role-owned-textures';

export interface RoleTankTextureConfirmation {
  instanceId: number;
  textures: OwnedTankTextures;
  tokens: number;
  money: number;
  result: number;
}
