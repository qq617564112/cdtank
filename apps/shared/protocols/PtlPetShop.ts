import type {OwnedRoleRecordData} from './PtlOwnedRoles';
import type {ShopCurrency} from './PtlShop';

export interface PetShopProduct {
  petId: number;
  name: string;
  info: string;
  moneyPrice: number;
  tokenPrice: number;
  maxHp: number;
  petType?: number;
  petSize?: number;
}

export interface ReqPetShop {
  operation: 'QUERY' | 'BUY';
  petId?: number;
  currency?: ShopCurrency;
  requestId?: string;
}

export interface ResPetShop {
  pets: PetShopProduct[];
  money?: number;
  tokens?: number;
  purchased?: OwnedRoleRecordData;
  replayed?: boolean;
}
