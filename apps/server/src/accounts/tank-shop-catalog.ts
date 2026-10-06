import {readFileSync} from 'node:fs';
import type {TankShopProduct} from '../../../shared/protocols/PtlTankShop';
import {sourceTablePath} from '../runtime/content-paths';

interface Table {rows: {values: Record<string, string>}[];}
export interface TankShopDefinition {
  product: TankShopProduct;
  moneyOnly: true;
  partCapacity: number;
  base: {attack: number; attackBonus: number; defense: number; defenseBonus: number};
}
const shops = (JSON.parse(readFileSync(sourceTablePath('tankshop'), 'utf8')) as Table).rows
  .map(row => row.values).filter(shop => Number(shop['坦克金钱价']) > 0 && shop['购买方式'] === '2');
const tanks = new Map((JSON.parse(readFileSync(sourceTablePath('tank'), 'utf8')) as Table).rows
  .map(row => [Number(row.values.ID), row.values]));

/** Positive-price source shop tanks; purchase mode2 permits MONEY only. */
export function tankShopCatalog(): TankShopDefinition[] {
  return shops.map(shop => {
    const tankId = Number(shop['坦克ID']);
    const tank = tanks.get(tankId)!;
    return {product: {tankId, name: tank.TankName, info: tank.TankInfo,
    moneyPrice: Number(shop['坦克金钱价']), tokenPrice: Number(shop['坦克代币价']),
    tankType: Number(tank.TankType), defaultDurability: Number(shop['耐久度默认']),
    textures: {U: Number(shop['默认贴图(炮塔)']), M: Number(shop['默认贴图(车身)']), XY: Number(shop['默认贴图(履带)'])}},
  moneyOnly: true, partCapacity: Number(tank.TankPartSlot), base: {attack: Number(tank.TankAtk), attackBonus: Number(tank.TankAtkBonus),
    defense: Number(tank.TankDef), defenseBonus: Number(tank.TankDefBonus)}};
  });
}
