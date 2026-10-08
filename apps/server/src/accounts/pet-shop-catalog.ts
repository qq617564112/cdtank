import {content} from '../content';
import type {PetShopProduct} from '../../../shared/protocols/PtlPetShop';

export interface PetShopDefinition {
  product: PetShopProduct;
  base: {critical: number; lucky: number; skills: number[]; levels: number[]};
}
/** Purchase data and newborn ranks come from the pet definition. */
export function petShopCatalog(): PetShopDefinition[] {
  return [...content.pets.values()].filter(pet => pet.shop.available).map(pet => ({
    product: {petId: pet.id, name: pet.name, info: pet.description, moneyPrice: pet.prices.money,
      tokenPrice: pet.prices.tokens, maxHp: pet.attributes.maxHp, petType: pet.petType, petSize: pet.petSize},
    base: {critical: pet.attributes.critical, lucky: pet.attributes.lucky,
      skills: pet.skills.map(skill => skill.baseId), levels: pet.skills.map(skill => skill.initialRank)},
  }));
}
