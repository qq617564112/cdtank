import type {CombatCatalog, CombatItemDefinition, CombatSkillDefinition} from '../combat/catalog';

export interface ContentSound {id: number; asset: string;}
export interface ContentPrice {money: number; tokens: number;}
export interface ContentShop {available: boolean; group: 'pet' | 'tank' | 'consumable' | 'part';}
export interface PetSkillDefinition {
  baseId: number; name?: string;
  initialRank: number;
  rankCap: number;
  levels: number[];
  event?: string;
  handler?: string;
  target?: 'self' | 'teammates' | 'team';
  condition?: 'moving' | 'stationary' | 'lowHealth';
}
export interface PetDefinition {
  kind: 'pet'; id: number; key: string; name: string; description: string;
  prices: ContentPrice; shop: ContentShop; starter: boolean; defaultSelected: boolean;
  petType: number; petSize: number;
  attributes: {maxHp: number; critical: number; lucky: number; mastery: number[]};
  growth: Record<string, number>;
  resources: {model: string; textures: string[]; action: string; animationSpeed: number};
  skills: PetSkillDefinition[];
}
export interface TankDefinition {
  kind: 'tank'; id: number; key: string; name: string; description: string;
  prices: ContentPrice; basePrices: ContentPrice; shop: ContentShop; starter: boolean; defaultSelected: boolean;
  battleReward: boolean; tankType: number; partCapacity: number; defaultDurability?: number;
  textures: {U: number; M: number; XY: number};
  attributes: {attack: number; attackBonus: number; defense: number; defenseBonus: number;
    speed: number; turn: number; reload: number; bullets: number; sideDefense: number; backDefense: number};
  growth: {minAttack: number; maxAttack: number; minAttackBonus: number; maxAttackBonus: number;
    minDefense: number; maxDefense: number; minDefenseBonus: number; maxDefenseBonus: number};
  resources: {textures: Record<string, string>; trackTextures: {A: string; B: string}; unresolvedTextures?: string[];
    textureVariants: TankTextureDefinition[];
    components: {part: string; actions: unknown[]}[]; animationSpeed: number; destroySound: ContentSound};
  runtime: {fixedTurret: boolean; handler: string};
}
export interface TankTextureDefinition {
  recordId: number; tankId: number; part: 'U' | 'M' | 'XY'; filename: string; name: string;
  rarity: number; selectable: boolean; moneyPrice: number; tokenPrice: number;
  textures: {A: TextureResource; B: TextureResource | null};
}
export interface TextureResource {request: string; source: string | null; asset: string | null; status: string;}
export interface ItemDefinition extends Omit<CombatItemDefinition, 'itemTableId' | 'info' | 'moneyPrice' | 'tokenPrice' | 'iconId' | 'skillIds'> {
  kind: 'item' | 'ammo' | 'trap' | 'part'; id: number; key: string; description: string;
  prices: ContentPrice; shop: ContentShop; category: number; inventoryCategory: number;
  equipmentTarget?: 'PART' | 'DECORATION' | 'MARK';
  appearanceEffect: boolean; treasure: boolean; cpuAvailable: boolean;
  unresolvedSkillReferences?: number[];
  resources: {model: string | null; sourceModel: string | null; modelStatus: string;
    fireSound?: ContentSound; disguise?: {name: string; model: string; sourceModel: string; textures: string[];
      meshName: string; transparent: boolean};
    textures: string[]; texturePath: string | null; modelId: number; modelType: number; texture: string; iconId: number};
  runtime: {passive?: string; use?: string; hit?: string;
    trap?: 'timedBomb' | 'contactMine' | 'moveRestraint' | 'turnRestraint' | 'fireRestraint'
      | 'groupRestraint' | 'teamHeal' | 'blast'; defaultAmmo?: boolean;
    query?: 'instant' | 'projectile'; projectileSpeed?: number; range?: number;
    muzzleForward?: number; muzzleHeight?: number;
    sceneResult: boolean; remoteShotResult: boolean; victimShotResult: boolean; sceneResultAfterDamage: boolean;
    finiteCpuAmmo: boolean; requiresPlayerTarget: boolean; markerReward: boolean; equipmentGroup?: string;
    values: Record<string, number>; skillRoles: Record<string, number>};
}
export type ContentCombatItem = ItemDefinition & CombatItemDefinition;
export interface SkillDefinition extends CombatSkillDefinition {
  key: string;
  runtime: {retainedEffect: boolean; queuedEffect: boolean; queueIntervalSeconds: number; worldSoundEvents: string[];
    rewardModifier?: {param: 'x' | 'y' | 'z'; field: 'moneyPercent' | 'originalityPercent' | 'techPercent'}};
  learning?: {groupId: number; level: number; cost: number};
}
export interface ContentIndex {
  pets: string[]; tanks: string[]; items: string[]; skills: string[];
  dataScales: CombatCatalog['dataScales'];
  rules: {
    equipmentRewards: {itemChance: number; tankChance: number};
    groundDrops: {chance: number; quantity: number; lifetimeSeconds: number};
  };
}
export type ContentDefinition = PetDefinition | TankDefinition | ItemDefinition | SkillDefinition;
