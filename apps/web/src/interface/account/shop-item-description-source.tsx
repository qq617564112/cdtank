import {SourceFeedbackText} from '../resources/source-feedback-text';
import './shop-item-description-source.css';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';

/** Original description sheet displays the selected confirmed catalog metadata. */
export function ShopItemDescriptionSource({ui, itemTableId, name, description}: {
  ui: HomeSourceUi; itemTableId: number; name: string; description: string;
}) {
  const suffix = 'shop_itemdesc.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  return <section className="shop-item-description-source" data-shop-description="" data-shop-product=""
    data-item-table-id={itemTableId} data-description-binding="web-confirmed-shop-info"
    data-description-attachment="web-below-item-lists" aria-label="商品说明">
    {['all', 'kuang'].map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
      suffix={suffix} name={name} aria-hidden="true" />)}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtType" text={name}
      data-description-type-binding="confirmed-item-name-getter" />
    <div {...sourceProps(ui, layout, suffix, 'edtDescription')} tabIndex={0}
      role="region" aria-label="道具介绍" data-shop-description-text="">{Array.from(description).map((character, index) => <SourceFeedbackText key={index} text={character}/>)}</div>
  </section>;
}
