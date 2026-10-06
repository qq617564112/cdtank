import {useRef} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {PetShopRowContent} from './pet-shop-row-content';
import {TankShopRowContent} from './tank-shop-row-content';
import {RoleShopListScrollbar} from './role-shop-list-scrollbar';
import './role-shop-source-list.css';

export interface RoleShopListEntry {id: number; name: string; moneyPrice?: number; tokenPrice?: number; petType?: number; petSize?: number; petMoney?: number; tankType?: number; tankMoney?: number; defaultDurability?: number; petId?: number; tankId?: number; durationMinutes?: number; owned?: boolean;}

/** Confirmed shop rows retain their existing labels and selection callbacks. */
export function RoleShopSourceList({ui, kind, entries, selected, busy, select}: {
  ui: HomeSourceUi; kind: 'tank' | 'pet'; entries: readonly RoleShopListEntry[];
  selected?: number; busy: boolean; select(id: number): void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const suffix = kind === 'tank' ? 'shop_tankpage.xml' : 'shop_petpage.xml';
  const source = kind === 'tank' ? 'lstTank' : 'lstPet';
  const layout = new HomeSourceLayout(ui, suffix);
  const properties = layout.control(source).properties;
  const selection = sourceProps(ui, layout, suffix, source, properties.SelectionImage);
  const identity = kind === 'tank' ? 'data-tank-shop-product-id' : 'data-pet-shop-product-id';
  return <div {...sourceProps(ui, layout, suffix, source)} className="role-shop-list-scroll-shell">
    <div ref={list} className="role-shop-source-list" role="listbox" aria-label={kind === 'tank' ? '战车商品' : '宠物商品'}
      aria-busy={busy} data-role-shop-list={kind} data-directory-binding="web-confirmed-shop-query"
      {...{[kind === 'tank' ? 'data-tank-shop-item' : 'data-pet-shop-item']: '',
        [kind === 'tank' ? 'data-selected-tank' : 'data-selected-pet']: selected ?? ''}}>
      {entries.map((entry, index) => <button key={entry.id} type="button" role="option" {...{[identity]: entry.id}}
        {...{[kind === 'pet' ? 'data-pet-shop-source-row' : 'data-tank-shop-source-row']: entry.id}}
        disabled={busy} aria-selected={selected === entry.id} tabIndex={selected === entry.id ? 0 : -1}
        style={selected === entry.id ? {backgroundImage: selection.style.backgroundImage} : undefined}
        data-source-selection-asset={selected === entry.id ? selection['data-source-asset'] : undefined}
        onClick={() => select(entry.id)} onKeyDown={event => {
          const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
            : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : undefined;
          if (next === undefined) return;
          event.preventDefault(); event.stopPropagation();
          const candidate = entries[Math.max(0, Math.min(entries.length - 1, next))];
          select(candidate.id);
          const button = list.current?.querySelector<HTMLButtonElement>(`[${identity}="${candidate.id}"]`);
          button?.focus(); button?.scrollIntoView({block: 'nearest'});
        }} onKeyUp={event => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.stopPropagation();
        }}>{kind === 'pet' ? <PetShopRowContent ui={ui} petId={entry.owned ? entry.petId : entry.id} name={entry.name}
          petType={entry.petType} petSize={entry.petSize} tokenPrice={entry.tokenPrice} petMoney={entry.petMoney} owned={entry.owned}/>
          : <TankShopRowContent ui={ui} tankId={entry.owned ? entry.tankId : entry.id} name={entry.name}
          tankType={entry.tankType} defaultDurability={entry.defaultDurability} tokenPrice={entry.tokenPrice} durationMinutes={entry.durationMinutes} tankMoney={entry.tankMoney} owned={entry.owned}/>}</button>)}
    </div>
    <RoleShopListScrollbar list={list} ui={ui} properties={properties}/>
  </div>;
}
