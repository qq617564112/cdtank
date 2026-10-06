import type {ResOwnedRoles} from './PtlOwnedRoles';

/** Rebuilt account RPC for the source TankUp table and owned equipment upgrade fields. */
export interface ReqTankUpgrade {
  operation: 'QUERY' | 'UPGRADE';
  instanceId?: number;
  action?: 1 | 2;
  requestId?: string;
}

export interface TankUpgradeQuote {
  instanceId: number;
  action: 1 | 2;
  currentLevel: number;
  nextLevel: number;
  nextAttributeMin: number;
  nextAttributeMax: number;
  nextBonusMin: number;
  nextBonusMax: number;
  enabled: boolean;
  moneyCost: number;
  originalityCost: number;
  success: number;
  fail: number;
  noEffect: number;
  canUpgrade: boolean;
  reason?: 'UPGRADE_TARGET_UNAVAILABLE' | 'UPGRADE_MONEY_REQUIRED'
    | 'UPGRADE_ORIGINALITY_REQUIRED' | 'UPGRADE_DISABLED';
}

export interface TankUpgradeConfirmation {
  action: 1 | 2;
  instanceId: number;
  money: number;
  originality: number;
  attribute: number;
  bonus: number;
  result: 0 | 1 | 2;
  level: number;
}

export interface ResTankUpgrade {
  owned: ResOwnedRoles;
  profile?: {bytes: number[]; strings: [string, string]};
  quotes: TankUpgradeQuote[];
  confirmation?: TankUpgradeConfirmation;
  historicalConfirmation?: TankUpgradeConfirmation;
  replayed?: boolean;
}
