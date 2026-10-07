import {SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {sourcePartOwnedKind, sourcePartOwnedDays} from './part-shop-owned-row-display';
import type {ShopItem} from '../../../../shared/protocols/PtlShop';
import {sourceShopPrice, sourceShopOwnedPrice} from './shop-item-display';
import './part-shop-row-content.css';

/** Original4ba7df CommonPart row with original owned/product text providers. */
export function PartShopRowContent({ui, name, iconId, itemTableId, ownedQuantity, moneyPrice, product, installed}: {
  ui: HomeSourceUi; name: string; iconId: number; itemTableId: number; ownedQuantity?: number; moneyPrice?: number; product?: ShopItem; installed?: boolean;
}) {
  const layout = new HomeSourceLayout(ui, 'shop_partpage.xml');
  const icon = sourceProps(ui, layout, 'shop_partpage.xml', product ? 'lstShopEquip' : 'lstMyEquip',
    `set:daoju0 image:data\\ui\\daoju\\${String(iconId).padStart(5, '0')}.tga`);
  const colour = installed === true && !product ? '#808080' : undefined;
  return <>
    <span className="part-shop-owned-row-icon" data-part-owned-row-icon="" aria-hidden="true"
      data-source-asset={icon['data-source-asset']} style={{backgroundImage: icon.style.backgroundImage}} />
    <span className="part-shop-owned-row-name" data-part-owned-row-name=""><SourceFeedbackText text={name} colour={colour}/></span>
    <span className="part-shop-owned-row-secondary" data-part-owned-row-kind="" data-source-binding="item-id-kind"><SourceFeedbackText text={sourcePartOwnedKind(itemTableId)} colour={colour}/></span>
    <span className="part-shop-owned-row-tertiary" data-part-owned-row-days="" data-source-binding={product ? "item-durable" : "myitem-quantity"}><SourceFeedbackText text={product ? product.durable === undefined ? '' : `（${product.durable | 0}天）` : sourcePartOwnedDays(ownedQuantity)} colour={colour}/></span>
    <span className="part-shop-owned-row-fourth" data-part-owned-row-price="" data-source-binding={product ? "item-original-purchase-price" : "item-money-original-half"}><SourceFeedbackText text={product ? sourceShopPrice(product) : sourceShopOwnedPrice(moneyPrice)} colour={colour}/></span>
  </>;
}
