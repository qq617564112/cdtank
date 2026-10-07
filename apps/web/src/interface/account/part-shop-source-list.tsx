import type {ShopItem} from '../../../../shared/protocols/PtlShop';
import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import {useRef} from 'react';
import {PartShopRowContent} from './part-shop-row-content';
import {PartShopListScrollbar} from './part-shop-list-scrollbar';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

export interface ShopSourceListEntry {id: number; name: string; iconId: number; detail: string; itemTableId?: number; ownedQuantity?: number; moneyPrice?: number; product?: ShopItem; installed?: boolean;}

/** Original list bounds and selection image with React-owned candidate and keyboard focus. */
export function PartShopSourceList({ui, source, entries, selected, busy, select, activate, canActivate}: {
  ui: HomeSourceUi; source: 'lstShopEquip' | 'lstMyEquip'; entries: ShopSourceListEntry[];
  selected?: number; busy: boolean; select: (id: number) => void;
  activate?: (id: number, button: HTMLButtonElement) => void; canActivate?: (id: number) => boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const layout = new HomeSourceLayout(ui, 'shop_partpage.xml');
  const selection = sourceProps(ui, layout, 'shop_partpage.xml', source, layout.control(source).properties.SelectionImage);
  function move(index: number) {
    const entry = entries[Math.max(0, Math.min(entries.length - 1, index))];
    if (!entry) return;
    select(entry.id);
    const button = root.current?.querySelector<HTMLButtonElement>(`[data-part-list-id="${entry.id}"]`);
    button?.focus(); button?.scrollIntoView({block: 'nearest'});
  }
  const productGrid = source === 'lstShopEquip' && entries.some(entry => entry.product && entry.itemTableId! >= 13001 && entry.itemTableId! <= 18000);
  return <div {...sourceProps(ui, layout, 'shop_partpage.xml', source)} className="part-shop-list-scroll-shell">
    <div ref={root} className="part-shop-source-list"
    {...(source === 'lstShopEquip' ? {'data-part-shop-item': '', 'data-selected-part': selected ?? ''} : {'data-part-owned-list': ''})}
    data-part-common-product-grid={productGrid ? '' : undefined}
    role="listbox" aria-label={source === 'lstShopEquip' ? '商品' : '已拥有物品'} aria-busy={busy}>
    {entries.map((entry, index) => {
      const ownedType = entry.itemTableId === undefined ? undefined : classifyItemId(entry.itemTableId);
      const originalOwnedRow = source === 'lstMyEquip' && entry.itemTableId !== undefined
        && (entry.itemTableId >= 13001 && entry.itemTableId <= 18000 || ownedType === 5 || ownedType === 7);
      const originalProductRow = productGrid && entry.itemTableId !== undefined && entry.itemTableId >= 13001 && entry.itemTableId <= 18000;
      const icon = sourceProps(ui, layout, 'shop_partpage.xml', source,
        `set:daoju0 image:data\\ui\\daoju\\${String(entry.iconId).padStart(5, '0')}.tga`);
      return <button key={entry.id} type="button" role="option" aria-selected={entry.id === selected}
        disabled={busy} data-part-list-id={entry.id}
        data-part-sale-available={source === 'lstMyEquip' ? Boolean(activate && canActivate?.(entry.id)) : undefined}
        {...(originalOwnedRow ? {'data-part-owned-source-row': entry.id} : originalProductRow ? {'data-part-product-source-row': entry.id} : {})}
        {...(source === 'lstShopEquip' ? {'data-part-product-id': entry.id} : {'data-part-owned-instance': entry.id})}
        tabIndex={entry.id === selected || selected === undefined && index === 0 ? 0 : -1}
        style={entry.id === selected ? {backgroundImage: selection.style.backgroundImage} : undefined}
        data-source-asset={entry.id === selected ? selection['data-source-asset'] : undefined}
        onClick={() => select(entry.id)}
        onDoubleClick={event => {if (source === 'lstMyEquip' && !busy && canActivate?.(entry.id)) activate?.(entry.id, event.currentTarget);}}
        onKeyDown={event => {
          if (event.key === 'Enter' && source === 'lstMyEquip' && activate) {
            event.preventDefault(); event.stopPropagation();
            if (!event.repeat && !busy && canActivate?.(entry.id)) activate(entry.id, event.currentTarget);
            return;
          }
          const target = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
            : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : undefined;
          if (target !== undefined) {event.preventDefault(); event.stopPropagation(); move(target);}
        }} onKeyUp={event => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.stopPropagation();
        }}>
        {originalOwnedRow || originalProductRow ? <PartShopRowContent ui={ui} name={entry.name} iconId={entry.iconId}
          itemTableId={entry.itemTableId!} ownedQuantity={entry.ownedQuantity} moneyPrice={entry.moneyPrice}
          installed={originalProductRow ? undefined : entry.installed} product={originalProductRow ? entry.product : undefined}/> : <>
        <span className="shop-list-icon" aria-hidden="true" style={{backgroundImage: icon.style.backgroundImage}}
          data-source-asset={icon['data-source-asset']} />
        <span className="shop-list-text"><span>{entry.name}</span><span>{entry.detail}</span></span>
        </>}
      </button>;
    })}
    </div>
    <PartShopListScrollbar list={root} ui={ui} properties={layout.control(source).properties} />
  </div>;
}
