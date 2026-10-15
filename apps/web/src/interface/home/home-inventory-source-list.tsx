import {GameSelectionHighlight} from '../resources/game-selection-highlight';
import {playButtonSound} from '../../audio/button-sound';
import {useRef} from 'react';
import {useTouchItemDescription} from '../resources/use-touch-item-description';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {HomeInventoryScrollbar} from './home-inventory-scrollbar';
import {HomeItemRowContent} from './home-item-row-content';
import './home-inventory-source-list.css';

export interface HomeInventoryListEntry {
  instanceId: number; itemTableId: number; name: string; info: string; ownedQuantity: number; iconId: number;
}

/** Source bounds and pictures surround confirmed inventory; selection is local. */
export function HomeInventorySourceList({ui, entries, selected, busy, itemRows, valuableRows = false, select, activate,
  describe, dismissDescription, described}: {
  ui: HomeSourceUi; entries: readonly HomeInventoryListEntry[]; selected: number;
  busy: boolean; itemRows: boolean; valuableRows?: boolean; select(instanceId: number): void;
  activate?(instanceId: number): void;
  describe?(entry: HomeInventoryListEntry, anchor: HTMLButtonElement): void;
  dismissDescription?(): void; described?: number;
}) {
  const list = useRef<HTMLDivElement>(null);
  const touchDescription = useTouchItemDescription(describe);
  const layout = new HomeSourceLayout(ui, 'myhome_playerpage.xml');
  const controlName = valuableRows ? 'lstPlayerValuable' : 'lstPlayerItem';
  const control = layout.control(controlName);
  return <div {...sourceProps(ui, layout, 'myhome_playerpage.xml', controlName)}
    className="home-inventory-list-scroll-shell">
    <div ref={list} className="home-inventory-source-list" role="listbox" aria-label={valuableRows ? '拥有贵重品' : '拥有物品'}
      aria-busy={busy} data-home-inventory-list="" onMouseLeave={dismissDescription} onScroll={dismissDescription}
      onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) dismissDescription?.();}}>
      {entries.map((entry, index) => {
        return <button key={entry.instanceId} type="button" role="option" draggable={!busy && !valuableRows} disabled={busy}
          data-inventory-instance={entry.instanceId} data-touch-double-click={activate ? '' : undefined}
          aria-selected={selected === entry.instanceId}
          data-home-source-item-row={itemRows ? '' : undefined}
          data-home-source-weapon-row={!itemRows && !valuableRows ? '' : undefined}
          data-home-source-valuable-row={valuableRows ? '' : undefined}
          aria-pressed={selected === entry.instanceId}
          aria-describedby={described === entry.instanceId ? 'home-item-description' : undefined}
          {...touchDescription(entry)}
          onPointerEnter={event => {if (event.pointerType !== 'touch') describe?.(entry, event.currentTarget);}}
          onFocus={event => {if (event.currentTarget.matches(':focus-visible')) describe?.(entry, event.currentTarget);}}
          onContextMenu={event => {event.preventDefault(); describe?.(entry, event.currentTarget);}}
          onClick={() => select(entry.instanceId)} onDoubleClick={activate ? () => activate(entry.instanceId) : undefined}
          onDragStart={valuableRows ? undefined : event => {
            dismissDescription?.();
            event.dataTransfer.setData('text/plain', String(entry.instanceId)); event.dataTransfer.effectAllowed = 'copy';
          }} onKeyDown={event => {
            if (event.key === 'Enter' && activate) {
              event.preventDefault(); event.stopPropagation(); playButtonSound(); activate(entry.instanceId); return;
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
          {selected === entry.instanceId && <GameSelectionHighlight/>}
          <HomeItemRowContent ui={ui} {...entry} />
        </button>;
      })}
    </div>
    <HomeInventoryScrollbar list={list} ui={ui} properties={control.properties}/>
  </div>;
}
