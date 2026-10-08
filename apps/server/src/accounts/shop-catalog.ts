import {content} from '../content';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {ShopItem} from '../../../shared/protocols/PtlShop';

function shopItems(catalog: CombatCatalog, group: 'consumable' | 'part'): ShopItem[] {
  return catalog.items.filter(item => {
    const shop = content.items.get(item.itemTableId)?.shop;
    return shop?.available && shop.group === group;
  }).map(item => {
    if (!Number.isInteger(item.iconId) || item.iconId! <= 0
        || ![item.moneyPrice, item.tokenPrice, item.getMethod, item.durable].every(price =>
          price !== undefined && Number.isInteger(price) && price >= 0 && price <= 0xffffffff)) {
      throw new Error(`商品${item.itemTableId}价格、图标与显示字段缺失`);
    }
    return {itemTableId: item.itemTableId, name: item.name, info: item.info, iconId: item.iconId!,
      moneyPrice: item.moneyPrice!, tokenPrice: item.tokenPrice!, getMethod: item.getMethod!, durable: item.durable!};
  });
}
export function consumableShopItems(catalog: CombatCatalog): ShopItem[] {return shopItems(catalog, 'consumable');}
export function partShopItems(catalog: CombatCatalog): ShopItem[] {return shopItems(catalog, 'part');}
