import {HomeEquipmentCommonRowContent} from './home-equipment-common-row-content';
import {useRef} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {HomeEquipmentListScrollbar} from './home-equipment-list-scrollbar';
import './home-equipment-source-list.css';

export interface HomeEquipmentListEntry {
  instanceId: number; itemTableId: number; name: string; info: string; ownedQuantity: number; iconId: number;
  installed?: boolean;
}

/** Source bounds and pictures surround confirmed inventory; selection is local. */
export function HomeEquipmentSourceList({ui, entries, selected, busy, select}: {
  ui: HomeSourceUi; entries: readonly HomeEquipmentListEntry[]; selected?: number;
  busy: boolean; select(instanceId: number): void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const layout = new HomeSourceLayout(ui, 'myhome_panzerpage.xml');
  const control = layout.control('lstEquip');
  const selection = sourceProps(ui, layout, 'myhome_panzerpage.xml', 'lstEquip', control.properties.SelectionImage);
  return <div {...sourceProps(ui, layout, 'myhome_panzerpage.xml', 'lstEquip')}
    className="home-equipment-list-scroll-shell">
    <div ref={list} className="home-equipment-source-list" role="listbox" aria-label="拥有装备"
      aria-busy={busy} data-home-equipment-list="">
      {entries.map((entry, index) => {
        const common = entry.itemTableId >= 13001 && entry.itemTableId <= 18000;
        const hat = entry.itemTableId >= 10001 && entry.itemTableId <= 11000;
        const balloon = entry.itemTableId >= 11001 && entry.itemTableId <= 12000;
        const mark = entry.itemTableId >= 12001 && entry.itemTableId <= 13000;
        const icon = sourceProps(ui, layout, 'myhome_panzerpage.xml', 'lstEquip',
          `set:daoju0 image:data\\ui\\daoju\\${String(entry.iconId).padStart(5, '0')}.tga`);
        return <button key={entry.instanceId} type="button" role="option" disabled={busy}
          data-equipment-item={entry.instanceId} data-home-equipment-common-row={common ? entry.instanceId : undefined} data-home-equipment-hat-mark-row={hat || balloon || mark ? entry.instanceId : undefined} aria-selected={selected === entry.instanceId}
          aria-pressed={selected === entry.instanceId} title={entry.info}
          style={selected === entry.instanceId ? {backgroundImage: selection.style.backgroundImage} : undefined}
          data-source-selection-asset={selected === entry.instanceId ? selection['data-source-asset'] : undefined}
          onClick={() => select(entry.instanceId)} onKeyDown={event => {
            const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
              : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : undefined;
            if (next === undefined) return;
            event.preventDefault(); event.stopPropagation();
            const candidate = entries[Math.max(0, Math.min(entries.length - 1, next))];
            select(candidate.instanceId);
            const button = list.current?.querySelector<HTMLButtonElement>(`[data-equipment-item="${candidate.instanceId}"]`);
            button?.focus(); button?.scrollIntoView({block: 'nearest'});
          }} onKeyUp={event => {
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.stopPropagation();
          }}>
          {common || hat || balloon || mark ? <HomeEquipmentCommonRowContent ui={ui} name={entry.name} iconId={entry.iconId}
            itemTableId={entry.itemTableId} ownedQuantity={entry.ownedQuantity} installed={common ? entry.installed : undefined}
            kindLabel={hat ? '坦克帽子' : balloon ? '坦克气球' : mark ? '坦克标志' : undefined}/> : <>
          <span className="home-equipment-source-icon" style={{backgroundImage: icon.style.backgroundImage}}
            data-source-asset={icon['data-source-asset']} aria-hidden="true" />
          <span>{entry.name} ×{entry.ownedQuantity}</span></>}
        </button>;
      })}
    </div>
    <HomeEquipmentListScrollbar list={list} ui={ui} properties={control.properties}/>
  </div>;
}
