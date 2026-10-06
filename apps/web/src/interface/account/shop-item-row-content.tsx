import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import './shop-item-row-content.css';

/** Original ConvenientPage row4b9251 with owned and product origins. */
export function ShopItemRowContent({ui, name, itemTableId, iconId, ownedQuantity, mode = 'owned', sourcePrice, offeredQuantity}: {
  ui: HomeSourceUi; name: string; itemTableId: number; iconId: number; ownedQuantity?: number; mode?: 'owned' | 'product'; sourcePrice?: string; offeredQuantity?: number;
}) {
  const layout = new HomeSourceLayout(ui, 'shop_itempage.xml');
  const icon = sourceProps(ui, layout, 'shop_itempage.xml', mode === 'owned' ? 'lstMyItem' : 'lstShopItem',
    `set:daoju0 image:data\\ui\\daoju\\${String(iconId).padStart(5, '0')}.tga`);
  const kind = classifyItemId(itemTableId);
  const prefix = mode === 'owned' ? 'shop-owned-item-row' : 'shop-product-row';
  const attr = (name: string) => ({[`data-${mode === 'owned' ? 'shop-owned-row' : 'shop-product-row'}-${name}`]: ''});
  return <>
    <span className={`shop-item-row-icon ${prefix}-icon`} aria-hidden="true"
      data-source-asset={icon['data-source-asset']} style={{backgroundImage: icon.style.backgroundImage}} />
    <span className={`shop-item-row-name ${prefix}-name`} {...attr('name')}>{name}</span>
    <span className={`shop-item-row-type ${prefix}-type`} {...attr('type')}>{{1: '道具', 2: '道具', 3: '炮弹', 4: '陷阱'}[kind] ?? ''}</span>
    {sourcePrice !== undefined && <span className="shop-item-row-price" {...attr('price')}
      data-price-provider={mode === 'owned' ? 'original-item-money-half' : 'original-item-getmethod'}>{sourcePrice}</span>}
    <span className={`shop-item-row-quantity ${prefix}-quantity`} {...attr('quantity')}
      data-source-quantity-field={mode === 'owned' ? 'MyItem+0x10' : 'Item+0xf8/439950'}>{(mode === 'owned' ? ownedQuantity : offeredQuantity) ?? ''}</span>
  </>;
}
