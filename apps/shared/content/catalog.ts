import type {CombatCatalog} from '../combat/catalog';
import type {ContentCombatItem, ContentIndex, ItemDefinition, PetDefinition, SkillDefinition, TankDefinition} from './types';

export class GameContent {
  readonly rules: ContentIndex['rules'];
  readonly pets: ReadonlyMap<number, PetDefinition>;
  readonly tanks: ReadonlyMap<number, TankDefinition>;
  readonly items: ReadonlyMap<number, ItemDefinition>;
  readonly skills: ReadonlyMap<number, SkillDefinition>;
  readonly combatCatalog: Omit<CombatCatalog, 'items' | 'skills'> & {items: ContentCombatItem[]; skills: SkillDefinition[]};

  constructor(index: ContentIndex, pets: PetDefinition[], tanks: TankDefinition[],
      items: ItemDefinition[], skills: SkillDefinition[]) {
    this.rules = index.rules;
    this.pets = new Map(pets.map(definition => [definition.id, definition]));
    this.tanks = new Map(tanks.map(definition => [definition.id, definition]));
    this.items = new Map(items.map(definition => [definition.id, definition]));
    this.skills = new Map(skills.map(definition => [definition.skillId, definition]));
    this.combatCatalog = {skills, items: items.map(item => ({...item, itemTableId: item.id,
      skillIds: [item.runtime.skillRoles.primary, item.runtime.skillRoles.secondary, item.runtime.skillRoles.tertiary],
      iconId: item.resources.iconId, info: item.description, moneyPrice: item.prices.money, tokenPrice: item.prices.tokens})),
    dataScales: index.dataScales, petSkillPrices: skills.flatMap(skill => skill.learning ? [{skillId: skill.skillId, ...skill.learning}] : []),
    petTypes: pets.map(pet => ({petId: pet.id, petType: pet.petType, petSize: pet.petSize,
      petMoney: pet.prices.money, baseIds: pet.skills.map(skill => skill.baseId),
      rankCaps: pet.skills.map(skill => skill.rankCap)})),
    tankTypes: tanks.map(tank => ({tankId: tank.id, tankType: tank.tankType,
      partSlotCount: tank.partCapacity, tankMoney: tank.basePrices.money, tankCoin: tank.basePrices.tokens}))};
  }

  item(key: string): ItemDefinition {
    const item = [...this.items.values()].find(item => item.key === key);
    if (!item) throw new Error(`物品定义缺失：${key}`);
    return item;
  }

  skill(key: string): SkillDefinition {
    const skill = [...this.skills.values()].find(skill => skill.key === key);
    if (!skill) throw new Error(`技能定义缺失：${key}`);
    return skill;
  }
}

let activeContent: GameContent | undefined;
export function installGameContent(content: GameContent): void {activeContent = content;}
export function gameContent(): GameContent {
  if (!activeContent) throw new Error('内容定义尚未载入');
  return activeContent;
}
export function contentItemId(key: string): number {return gameContent().item(key).id;}
export function contentSkillId(key: string): number {return gameContent().skill(key).skillId;}
export function defaultAmmoId(): number {
  return [...gameContent().items.values()].find(item => item.runtime.defaultAmmo)!.id;
}
export function itemUseHandler(id: number): string | undefined {return gameContent().items.get(id)?.runtime.use;}
export function itemHitHandler(id: number | undefined): string | undefined {
  return id === undefined ? undefined : gameContent().items.get(id)?.runtime.hit;
}
export function itemTrapHandler(id: number | undefined): string | undefined {
  return id === undefined ? undefined : gameContent().items.get(id)?.runtime.trap;
}
export function itemForHandler(route: 'use' | 'hit' | 'trap' | 'passive', handler: string): ItemDefinition {
  const item = [...gameContent().items.values()].find(item => item.runtime[route] === handler);
  if (!item) throw new Error(`物品处理定义缺失：${route}/${handler}`);
  return item;
}
export function tankTextureCatalog(): {rows: TankDefinition['resources']['textureVariants']} {
  return {rows: [...gameContent().tanks.values()].flatMap(tank => tank.resources.textureVariants)};
}

export function rankedPetSkillId(baseId: number, rank: number): number | undefined {
  const rule = [...gameContent().pets.values()].flatMap(pet => pet.skills).find(skill => skill.baseId === baseId);
  return rule?.levels[rank - 1];
}
