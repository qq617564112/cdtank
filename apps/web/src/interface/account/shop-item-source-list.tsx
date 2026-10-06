import type {ShopItem} from '../../../../shared/protocols/PtlShop';
import {sourceShopOfferedQuantity, sourceShopPrice, sourceShopOwnedPrice} from './shop-item-display';
import {SourceFeedbackText} from '../resources/source-feedback-text';
import {useRef} from 'react';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {ShopListScrollbar} from './shop-list-scrollbar';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {ShopItemRowContent} from './shop-item-row-content';

export interface ShopSourceListEntry {
  id: number; name: string; iconId: number; detail: string;
  itemTableId?: number; ownedQuantity?: number; ownedMoneyPrice?: number; product?: ShopItem;
}

/** Original list bounds and selection image with React-owned candidate and keyboard focus. */
export function ShopItemSourceList({ui, source, entries, selected, busy, select, activate, canActivate}: {
  ui: HomeSourceUi; source: 'lstShopItem' | 'lstMyItem'; entries: ShopSourceListEntry[];
  selected?: number; busy: boolean; select: (id: number) => void;
  activate?: (id: number) => void; canActivate?: (id: number) => boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const layout = new HomeSourceLayout(ui, 'shop_itempage.xml');
  const selection = sourceProps(ui, layout, 'shop_itempage.xml', source, layout.control(source).properties.SelectionImage);
  function move(index: number) {
    const entry = entries[Math.max(0, Math.min(entries.length - 1, index))];
    if (!entry) return;
    select(entry.id);
    const button = root.current?.querySelector<HTMLButtonElement>(`[data-shop-list-id="${entry.id}"]`);
    button?.focus(); button?.scrollIntoView({block: 'nearest'});
  }
  return <div {...sourceProps(ui, layout, 'shop_itempage.xml', source)} className="shop-list-scroll-shell">
    <div ref={root} className="shop-item-source-list"
    {...(source === 'lstShopItem' ? {'data-shop-item': '', 'data-selected-item': selected ?? '', 'data-shop-source-product-grid': ''} : {'data-shop-owned-list': ''})}
    role="listbox" aria-label={source === 'lstShopItem' ? '商品' : '已拥有物品'} aria-busy={busy}>
    {entries.map((entry, index) => {
      const ownedItemRow = source === 'lstMyItem' && entry.itemTableId !== undefined
        && [1, 2].includes(classifyInventoryCategory(entry.itemTableId)) && entry.ownedQuantity !== undefined;
      const icon = sourceProps(ui, layout, 'shop_itempage.xml', source,
        `set:daoju0 image:data\\ui\\daoju\\${String(entry.iconId).padStart(5, '0')}.tga`);
      return <button key={entry.id} type="button" role="option" aria-selected={entry.id === selected}
        disabled={busy} data-shop-list-id={entry.id}
        {...(ownedItemRow ? {'data-shop-source-owned-item-row': ''} : source === 'lstShopItem' ? {'data-shop-source-product-row': ''} : {})}
        {...(source === 'lstShopItem' ? {'data-shop-product-id': entry.id} : {'data-shop-owned-instance': entry.id})}
        tabIndex={entry.id === selected || selected === undefined && index === 0 ? 0 : -1}
        style={entry.id === selected ? {backgroundImage: selection.style.backgroundImage} : undefined}
        data-source-asset={entry.id === selected ? selection['data-source-asset'] : undefined}
        data-stack-sale-available={source === 'lstMyItem' && Boolean(activate && canActivate?.(entry.id))}
        onDoubleClick={() => {if (source === 'lstMyItem' && !busy && canActivate?.(entry.id)) activate?.(entry.id);}}
        onClick={() => select(entry.id)} onKeyDown={event => {
          if (event.key === 'Enter' && source === 'lstMyItem' && activate && canActivate?.(entry.id)) {
            event.preventDefault(); activate(entry.id); return;
          }
          const target = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
            : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : undefined;
          if (target !== undefined) {event.preventDefault(); move(target);}
        }}>
        {ownedItemRow ? <ShopItemRowContent ui={ui} name={entry.name} itemTableId={entry.itemTableId!}
          iconId={entry.iconId} ownedQuantity={entry.ownedQuantity!}
          sourcePrice={sourceShopOwnedPrice(entry.ownedMoneyPrice)}/> : source === 'lstShopItem' ?
          <ShopItemRowContent ui={ui} name={entry.name} itemTableId={entry.id} iconId={entry.iconId}
            mode="product" offeredQuantity={entry.product && sourceShopOfferedQuantity(entry.product)}
            sourcePrice={entry.product ? sourceShopPrice(entry.product) : '' }/> : <>
        <span className="shop-list-icon" aria-hidden="true" style={{backgroundImage: icon.style.backgroundImage}}
          data-source-asset={icon['data-source-asset']} />
        <span className="shop-list-text"><span><SourceFeedbackText text={entry.name}/></span><span><SourceFeedbackText text={entry.detail}/></span></span>
        </>}
      </button>;
    })}
    </div>
    <ShopListScrollbar list={root} ui={ui} properties={layout.control(source).properties}/>
  </div>;
}
