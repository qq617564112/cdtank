import {classifyItemId} from '../../../shared/combat/item-hotkeys';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {ShopItem} from '../../../shared/protocols/PtlShop';

/** Bounded reconstructed availability: only items with integrated consumption workflows. */
export function consumableShopItems(catalog: CombatCatalog): ShopItem[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2011, 2012, 2013, 2014, 2015, 2017, 2018, 2019, 2020, 2021, 3001, 3002, 3003, 3004, 3005].map(id => {
    const item = catalog.items.find(row => row.itemTableId === id);
    if (!item || !Number.isInteger(item.iconId) || item.iconId! <= 0
        || ![item.moneyPrice, item.tokenPrice, item.getMethod, item.durable].every(price =>
          price !== undefined && Number.isInteger(price) && price >= 0 && price <= 0xffffffff)) {
      throw new Error(`消耗品${id}原表价格、图标与显示字段缺失`);
    }
    return {itemTableId: id, name: item.name, info: item.info, iconId: item.iconId!,
      moneyPrice: item.moneyPrice!, tokenPrice: item.tokenPrice!, getMethod: item.getMethod!, durable: item.durable!};
  });
}

const MARKER_SHOP_ITEM_IDS = new Set([12501, 12502, 12503]);

/** Original parts and the three Func19 marker items; availability is a rebuilt server policy. */
export function partShopItems(catalog: CombatCatalog): ShopItem[] {
  return catalog.items.filter(item => {
    const category = classifyItemId(item.itemTableId);
    const ordinaryPart = category >= 8 && category <= 12
      && (item.moneyPrice ?? 0) > 0 && (item.tokenPrice ?? 0) > 0;
    return ordinaryPart || (category === 7 && MARKER_SHOP_ITEM_IDS.has(item.itemTableId));
  }).map(item => {
    if (!Number.isInteger(item.iconId) || item.iconId! <= 0 ||
        ![item.moneyPrice, item.tokenPrice, item.getMethod, item.durable].every(price =>
          price !== undefined && Number.isInteger(price) && price >= 0 && price <= 0xffffffff)) {
      throw new Error(`部件${item.itemTableId}原表价格、图标与显示字段缺失`);
    }
    return {itemTableId: item.itemTableId, name: item.name, info: item.info, iconId: item.iconId!,
      moneyPrice: item.moneyPrice!, tokenPrice: item.tokenPrice!, getMethod: item.getMethod!, durable: item.durable!};
  });
}
