import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** The source shop sheet surrounds the confirmed consumable catalog and purchase session. */
export function ShopSourcePage({ui, money, tokens, close, category, busy, selectCategory, page = 'Item', selectPage, tankAvailable = false, petAvailable = false, partAvailable = false, mendAvailable = false, ownedCategory = 'Item', ownedBusy = false, ownedQuantity, selectOwnedCategory}: {
  ui: HomeSourceUi; money?: number; tokens?: number; close: () => void;
  category: 'Weapon' | 'Item'; busy: boolean; selectCategory: (category: 'Weapon' | 'Item') => void;
  page?: 'Item' | 'Tank' | 'Pet' | 'Part' | 'Mend'; selectPage?: (page: 'Item' | 'Tank' | 'Pet' | 'Part' | 'Mend') => void; tankAvailable?: boolean; petAvailable?: boolean; partAvailable?: boolean; mendAvailable?: boolean;
  ownedCategory?: 'Weapon' | 'Item'; ownedBusy?: boolean; ownedQuantity?: number;
  selectOwnedCategory?: (category: 'Weapon' | 'Item') => void;
}) {
  const root = new HomeSourceLayout(ui, 'shop.xml');
  const items = new HomeSourceLayout(ui, 'shop_itempage.xml');
  return <>
    {['anniuditu', 'zkb', 'hongsexiaodi', 'youbiandaditu'].map(name =>
      <SourceStaticImage key={name} ui={ui} layout={root} suffix="shop.xml" name={name} aria-hidden="true" />)}
    {(['Pet', 'Tank', 'Item', 'Part', 'Mend'] as const).map((kind, index) =>
      <SourceButton key={kind} ui={ui} layout={root} suffix="shop.xml" source={`rdo${kind}Page`}
        selected={kind === page} aria-label={['宠物', '战车', '道具', '部件', '维修中心'][index]}
        data-shop-root-category={kind} disabled={busy && (kind === 'Item' || kind === 'Tank' || kind === 'Pet' || kind === 'Part' || kind === 'Mend')}
        aria-pressed={kind === page} aria-disabled={kind !== 'Item' && !(kind === 'Tank' && tankAvailable) && !(kind === 'Pet' && petAvailable) && !(kind === 'Part' && partAvailable) && !(kind === 'Mend' && mendAvailable)}
        tabIndex={kind === 'Item' || kind === 'Tank' && tankAvailable || kind === 'Pet' && petAvailable || kind === 'Part' && partAvailable || kind === 'Mend' && mendAvailable ? 0 : -1}
        onClick={() => {if (!busy && (kind === 'Item' || kind === 'Tank' && tankAvailable || kind === 'Pet' && petAvailable || kind === 'Part' && partAvailable || kind === 'Mend' && mendAvailable)) selectPage?.(kind);}} />)}
    {page === 'Item' && <>
    {['heseditu', 'ditu', 'shuliangditu', 'changtiao', 'changtiao2', 'jinqiantubiao', 'jinqian',
      'chuangyidiantubiao2', 'xingbi'].map(name =>
      <SourceStaticImage key={name} ui={ui} layout={items} suffix="shop_itempage.xml" name={name} aria-hidden="true" />)}
    <SourceStaticText ui={ui} layout={items} suffix="shop_itempage.xml" name="txtMoney" text={money === undefined ? '' : String(money)} />
    <SourceStaticText ui={ui} layout={items} suffix="shop_itempage.xml" name="txtCoin" text={tokens === undefined ? '' : String(tokens)} />
    <SourceStaticText ui={ui} layout={items} suffix="shop_itempage.xml" name="txtMyListQuantity" text={ownedQuantity === undefined ? '' : String(ownedQuantity)} />
    {(['Weapon', 'Item'] as const).map((kind, index) =>
      <SourceButton key={`owned-${kind}`} ui={ui} layout={items} suffix="shop_itempage.xml" source={`rdoMy${kind}Page`}
        selected={kind === ownedCategory} aria-label={['拥有武器', '拥有道具'][index]}
        data-shop-owned-category={kind} disabled={ownedBusy}
        aria-pressed={kind === ownedCategory}
        onClick={() => selectOwnedCategory?.(kind)} />)}
    {(['Weapon', 'Item'] as const).map((kind, index) =>
      <SourceButton key={kind} ui={ui} layout={items} suffix="shop_itempage.xml" source={`rdoShop${kind}Page`}
        selected={kind === category} aria-label={['武器商品', '道具商品'][index]}
        data-shop-category={kind} disabled={busy}
        aria-pressed={kind === category}
        onClick={() => selectCategory(kind)} />)}
    </>}
    <SourceButton ui={ui} layout={root} suffix="shop.xml" source="btnClose" data-shop-close=""
      aria-label="返回大厅" onClick={close} />
  </>;
}
