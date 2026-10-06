import type {OwnedRoleRecordData} from './PtlOwnedRoles';
import type {ShopCurrency} from './PtlShop';

export interface TankShopProduct {
  tankId: number;
  name: string;
  info: string;
  moneyPrice: number;
  tokenPrice: number;
  tankType?: number;
  defaultDurability?: number;
  textures: {U: number; M: number; XY: number};
}

export interface ReqTankShop {
  operation: 'QUERY' | 'BUY';
  tankId?: number;
  currency?: ShopCurrency;
  requestId?: string;
}

export interface ResTankShop {
  tanks: TankShopProduct[];
  money?: number;
  tokens?: number;
  purchased?: OwnedRoleRecordData;
  replayed?: boolean;
}
