import type {TankDefinition} from '../../../shared/content/types';
import {content} from '../content';
import type {TankShopProduct} from '../../../shared/protocols/PtlTankShop';

export interface TankShopDefinition {
  product: TankShopProduct;
  partCapacity: number;
  base: {attack: number; attackBonus: number; defense: number; defenseBonus: number};
}
/** Shop and base values share the editable tank definition. */
export function tankShopCatalog(): TankShopDefinition[] {
  return [...content.tanks.values()].filter(tank => tank.shop.available).map(tankShopDefinition);
}

export function tankShopDefinition(tank: TankDefinition): TankShopDefinition {
  return {
    product: {tankId: tank.id, name: tank.name, info: tank.description,
      moneyPrice: tank.prices.money, tokenPrice: tank.prices.tokens, tankType: tank.tankType,
      defaultDurability: tank.defaultDurability, textures: tank.textures},
    partCapacity: tank.partCapacity,
    base: {attack: tank.attributes.attack, attackBonus: tank.attributes.attackBonus,
      defense: tank.attributes.defense, defenseBonus: tank.attributes.defenseBonus},
  };
}
