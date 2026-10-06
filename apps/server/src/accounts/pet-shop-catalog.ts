import {readFileSync} from 'node:fs';
import type {PetShopProduct} from '../../../shared/protocols/PtlPetShop';
import {sourceTablePath} from '../runtime/content-paths';

interface Table {rows: {values: Record<string, string>}[];}
export interface PetShopDefinition {
  product: PetShopProduct;
  base: {critical: number; lucky: number; skills: number[]; levels: number[]};
}
const paidPets = (JSON.parse(readFileSync(sourceTablePath('pet'), 'utf8')) as Table).rows
  .map(row => row.values).filter(pet => Number(pet.PetMoney) > 0);

/** Positive-price source pets; the recovered purchase entry checks MONEY only. */
export function petShopCatalog(): PetShopDefinition[] {
  return paidPets.map(pet => ({product: {petId: Number(pet.ID), name: pet.PetName, info: pet.PetInfo,
    moneyPrice: Number(pet.PetMoney), tokenPrice: Number(pet.PetCoin), maxHp: Number(pet.MaxHP),
    petType: Number(pet.PetType), petSize: Number(pet.PetSize)},
  base: {critical: Number(pet.Critical), lucky: Number(pet.Lucky),
    skills: Array.from({length: 6}, (_, index) => Number(pet[`Skill${index}`])),
    levels: Array.from({length: 6}, (_, index) => Number(pet[`SkillLv${index}`]))}}));
}
