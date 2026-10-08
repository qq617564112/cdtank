import {SourceFeedbackText} from '../resources/source-feedback-text';
import './shop-item-description-source.css';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';

/** Original description sheet displays the hovered or focused catalog entry. */
export function ShopItemDescriptionSource({ui, itemTableId, name, description, left, top}: {
  ui: HomeSourceUi; itemTableId: number; name: string; description: string; left: number; top: number;
}) {
  const suffix = 'shop_itemdesc.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  return <section id="shop-item-description" role="tooltip" className="shop-item-description-source"
    style={{left, top}} data-shop-description="" data-shop-product=""
    data-item-table-id={itemTableId} data-description-binding="web-confirmed-shop-info"
    data-description-attachment="item-hover-focus" aria-label="商品说明">
    {['all', 'kuang'].map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
      suffix={suffix} name={name} aria-hidden="true" />)}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtType" text={name}
      data-description-type-binding="confirmed-item-name-getter" />
    <div {...sourceProps(ui, layout, suffix, 'edtDescription')}
      role="region" aria-label="道具介绍" data-shop-description-text="">{Array.from(description).map((character, index) => <SourceFeedbackText key={index} text={character}/>)}</div>
  </section>;
}
