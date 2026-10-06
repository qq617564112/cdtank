import {useRef} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {HomeInventoryScrollbar} from './home-inventory-scrollbar';
import {HomeItemRowContent} from './home-item-row-content';
import './home-inventory-source-list.css';

export interface HomeInventoryListEntry {
  instanceId: number; itemTableId: number; name: string; info: string; ownedQuantity: number; iconId: number;
}

/** Source bounds and pictures surround confirmed inventory; selection is local. */
export function HomeInventorySourceList({ui, entries, selected, busy, itemRows, valuableRows = false, select, activate}: {
  ui: HomeSourceUi; entries: readonly HomeInventoryListEntry[]; selected: number;
  busy: boolean; itemRows: boolean; valuableRows?: boolean; select(instanceId: number): void;
  activate?(instanceId: number): void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const layout = new HomeSourceLayout(ui, 'myhome_playerpage.xml');
  const controlName = valuableRows ? 'lstPlayerValuable' : 'lstPlayerItem';
  const control = layout.control(controlName);
  const selection = sourceProps(ui, layout, 'myhome_playerpage.xml', controlName, control.properties.SelectionImage);
  return <div {...sourceProps(ui, layout, 'myhome_playerpage.xml', controlName)}
    className="home-inventory-list-scroll-shell">
    <div ref={list} className="home-inventory-source-list" role="listbox" aria-label={valuableRows ? '拥有贵重品' : '拥有物品'}
      aria-busy={busy} data-home-inventory-list="">
      {entries.map((entry, index) => {
        return <button key={entry.instanceId} type="button" role="option" draggable={!busy && !valuableRows} disabled={busy}
          data-inventory-instance={entry.instanceId} aria-selected={selected === entry.instanceId}
          data-home-source-item-row={itemRows ? '' : undefined}
          data-home-source-weapon-row={!itemRows && !valuableRows ? '' : undefined}
          data-home-source-valuable-row={valuableRows ? '' : undefined}
          aria-pressed={selected === entry.instanceId} title={entry.info}
          style={selected === entry.instanceId ? {backgroundImage: selection.style.backgroundImage} : undefined}
          data-source-selection-asset={selected === entry.instanceId ? selection['data-source-asset'] : undefined}
          onClick={() => select(entry.instanceId)} onDoubleClick={activate ? () => activate(entry.instanceId) : undefined}
          onDragStart={valuableRows ? undefined : event => {
            event.dataTransfer.setData('text/plain', String(entry.instanceId)); event.dataTransfer.effectAllowed = 'copy';
          }} onKeyDown={event => {
            if (event.key === 'Enter' && activate) {
              event.preventDefault(); event.stopPropagation(); activate(entry.instanceId); return;
            }
            const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
              : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : undefined;
            if (next === undefined) return;
            event.preventDefault(); event.stopPropagation();
            const candidate = entries[Math.max(0, Math.min(entries.length - 1, next))];
            select(candidate.instanceId);
            const button = list.current?.querySelector<HTMLButtonElement>(`[data-inventory-instance="${candidate.instanceId}"]`);
            button?.focus(); button?.scrollIntoView({block: 'nearest'});
          }} onKeyUp={event => {
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.stopPropagation();
          }}>
          <HomeItemRowContent ui={ui} {...entry} />
        </button>;
      })}
    </div>
    <HomeInventoryScrollbar list={list} ui={ui} properties={control.properties}/>
  </div>;
}
