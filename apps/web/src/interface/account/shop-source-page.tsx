import {ShopSourceButton as SourceButton} from './shop-source-button';
import {ShopOwnedPanel, ShopSourceBackground as SourceStaticImage} from './shop-source-background';
import {HomeStaticText as SourceStaticText} from '../home/home-text';
import {HomeSurfacePanel} from '../home/home-surface';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** The source shop sheet surrounds the confirmed consumable catalog and purchase session. */
export function ShopSourcePage({ui, money, tokens, close, category, busy, selectCategory, page = 'Item', selectPage, tankAvailable = false, petAvailable = false, partAvailable = false, mendAvailable = false, ownedCategory = 'Item', ownedBusy = false, selectOwnedCategory}: {
  ui: HomeSourceUi; money?: number; tokens?: number; close: () => void;
  category: 'Weapon' | 'Item'; busy: boolean; selectCategory: (category: 'Weapon' | 'Item') => void;
  page?: 'Item' | 'Tank' | 'Pet' | 'Part' | 'Mend'; selectPage?: (page: 'Item' | 'Tank' | 'Pet' | 'Part' | 'Mend') => void; tankAvailable?: boolean; petAvailable?: boolean; partAvailable?: boolean; mendAvailable?: boolean;
  ownedCategory?: 'Weapon' | 'Item'; ownedBusy?: boolean;
  selectOwnedCategory?: (category: 'Weapon' | 'Item') => void;
}) {
  const root = new HomeSourceLayout(ui, 'shop.xml');
  const items = new HomeSourceLayout(ui, 'shop_itempage.xml');
  const availablePages = {Item: true, Tank: tankAvailable, Pet: petAvailable, Part: partAvailable, Mend: mendAvailable};
  const panel = sourceProps(ui, root, 'shop.xml', 'youbiandaditu');
  const tab = sourceProps(ui, root, 'shop.xml', `rdo${page}Page`).style;
  return <>
    {['anniuditu', 'hongsexiaodi'].map(name =>
      <SourceStaticImage key={name} ui={ui} layout={root} suffix="shop.xml" name={name} aria-hidden="true" />)}
    <HomeSurfacePanel {...panel} className="shop-source-background" headerTab={{
      left: Number(tab.left) - Number(panel.style.left), width: Number(tab.width),
      rise: Number(panel.style.top) - Number(tab.top),
    }}/>
    {(['Pet', 'Tank', 'Item', 'Part', 'Mend'] as const).map((kind, index) =>
      <SourceButton key={kind} ui={ui} layout={root} suffix="shop.xml" source={`rdo${kind}Page`}
        selected={kind === page} aria-label={['宠物', '战车', '道具', '部件', '维修中心'][index]}
        data-shop-root-category={kind} disabled={busy || !availablePages[kind]}
        aria-busy={busy && availablePages[kind]} aria-pressed={kind === page} aria-disabled={!availablePages[kind]}
        tabIndex={availablePages[kind] ? 0 : -1}
        onClick={() => {if (!busy && availablePages[kind]) selectPage?.(kind);}} />)}
    {page === 'Item' && <>
    <ShopOwnedPanel ui={ui} suffix="shop_itempage.xml" tab={`rdoMy${ownedCategory}Page`}/>
    {['heseditu', 'ditu', 'shuliangditu', 'changtiao', 'changtiao2', 'jinqiantubiao', 'jinqian',
      'chuangyidiantubiao2', 'xingbi'].map(name =>
      <SourceStaticImage key={name} ui={ui} layout={items} suffix="shop_itempage.xml" name={name} aria-hidden="true" />)}
    <SourceStaticText ui={ui} layout={items} suffix="shop_itempage.xml" name="txtMoney" text={money === undefined ? '' : String(money)} />
    <SourceStaticText ui={ui} layout={items} suffix="shop_itempage.xml" name="txtCoin" text={tokens === undefined ? '' : String(tokens)} />
    {(['Weapon', 'Item'] as const).map((kind, index) =>
      <SourceButton key={`owned-${kind}`} ui={ui} layout={items} suffix="shop_itempage.xml" source={`rdoMy${kind}Page`}
        selected={kind === ownedCategory} aria-label={['拥有武器', '拥有道具'][index]}
        data-shop-owned-category={kind} disabled={ownedBusy} aria-busy={ownedBusy}
        aria-pressed={kind === ownedCategory}
        onClick={() => selectOwnedCategory?.(kind)} />)}
    {(['Weapon', 'Item'] as const).map((kind, index) =>
      <SourceButton key={kind} ui={ui} layout={items} suffix="shop_itempage.xml" source={`rdoShop${kind}Page`}
        selected={kind === category} aria-label={['武器商品', '道具商品'][index]}
        data-shop-category={kind} disabled={busy} aria-busy={busy}
        aria-pressed={kind === category}
        onClick={() => selectCategory(kind)} />)}
    </>}
    <SourceButton ui={ui} layout={root} suffix="shop.xml" source="btnClose" data-shop-close=""
      aria-label="返回大厅" onClick={close} />
  </>;
}
