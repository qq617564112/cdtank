import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {SourceButton} from '../resources/source-button';
export type PartShopCategory = 'Common' | 'Hat' | 'Mark';

/** Original part sheet regions and confirmed ownership categories. */
export function PartShopSourcePage({ui, money, tokens, quantity, ownedCategory, category, busy, markAvailable, selectOwned, selectCategory}: {
  ui: HomeSourceUi; money?: number; tokens?: number; quantity?: number; ownedCategory: PartShopCategory;
  category: PartShopCategory; busy: boolean; markAvailable: boolean; selectOwned: (category: PartShopCategory) => void;
  selectCategory: (category: PartShopCategory) => void;
}) {
  const suffix = 'shop_partpage.xml', layout = new HomeSourceLayout(ui, suffix);
  return <>
    {['heseditu', 'ditu', 'shuliangditu', 'changtiao', 'changtiao2', 'jinqiantubiao', 'jinqian',
      'chuangyidiantubiao2', 'xingbi'].map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
        suffix={suffix} name={name} className="part-shop-source-picture" aria-hidden="true" />)}
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtMoney" text={money === undefined ? '' : String(money)} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtCoin" text={tokens === undefined ? '' : String(tokens)} />
    <SourceStaticText ui={ui} layout={layout} suffix={suffix} name="txtMyListQuantity" text={quantity === undefined ? '' : String(quantity)} />
    {(['Common', 'Hat', 'Mark'] as const).map((kind, index) => <SourceButton key={'owned'+kind} ui={ui} layout={layout}
      suffix={suffix} source={`rdoMy${kind}Page`} selected={ownedCategory === kind} aria-pressed={ownedCategory === kind}
      aria-label={['拥有部件', '拥有装饰', '拥有标记'][index]} data-part-owned-category={kind} disabled={busy}
      onClick={() => selectOwned(kind)} />)}
    {(['Common', 'Hat', 'Mark'] as const).map((kind, index) => <SourceButton key={'shop'+kind} ui={ui} layout={layout}
      suffix={suffix} source={`rdoShop${kind}Page`} selected={category === kind} aria-pressed={category === kind}
      aria-label={['部件商品', '装饰商品', '标记商品'][index]} data-part-shop-category={kind}
      disabled={busy || kind === 'Hat' || kind === 'Mark' && !markAvailable}
      onClick={() => selectCategory(kind)} />)}
  </>;
}
