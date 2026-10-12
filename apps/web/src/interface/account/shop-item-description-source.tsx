import {GameItemTooltip} from '../resources/game-item-tooltip';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {HomeStaticText as SourceStaticText} from '../home/home-text';
import {sourceProps} from '../resources/source-ui-props';

/** The shared vector tooltip displays the hovered or focused catalog entry. */
export function ShopItemDescriptionSource({ui, itemTableId, name, description, left, top}: {
  ui: HomeSourceUi; itemTableId: number; name: string; description: string; left: number; top: number;
}) {
  const suffix = 'shop_itemdesc.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  return <GameItemTooltip id="shop-item-description" className="shop-item-description-source"
    style={{left, top}} data-shop-description="" data-shop-product=""
    data-item-table-id={itemTableId} data-description-binding="web-confirmed-shop-info"
    data-description-attachment="item-hover-focus" aria-label="商品说明">
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtType" text={name}
      className="game-item-tooltip-title"
      data-description-type-binding="confirmed-item-name-getter" />
    <div {...sourceProps(ui, layout, suffix, 'edtDescription')} className="game-item-tooltip-description"
      role="region" aria-label="道具介绍" data-shop-description-text="">{description}</div>
  </GameItemTooltip>;
}
