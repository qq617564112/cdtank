import {gameContent} from '../../../../shared/content/catalog';
import {HomeEquipmentCommonRowContent} from './home-equipment-common-row-content';
import {isAppearanceEffectItem} from '../../../../shared/combat/equipment-target';
import {useRef} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {HomeEquipmentListScrollbar} from './home-equipment-list-scrollbar';
import './home-equipment-source-list.css';

export interface HomeEquipmentListEntry {
  instanceId: number; itemTableId: number; name: string; info: string; ownedQuantity: number; iconId: number;
  bindingName?: string; installed?: boolean;
}

/** Source bounds and pictures surround confirmed inventory; selection is local. */
export function HomeEquipmentSourceList({ui, entries, selected, busy, select, dragType, tankInstanceId,
  describe, dismissDescription, described}: {
  ui: HomeSourceUi; entries: readonly HomeEquipmentListEntry[]; selected?: number;
  busy: boolean; select(instanceId: number): void;
  dragType: string; tankInstanceId?: number;
  describe?(entry: HomeEquipmentListEntry, anchor: HTMLButtonElement): void;
  dismissDescription?(): void; described?: number;
}) {
  const list = useRef<HTMLDivElement>(null);
  const layout = new HomeSourceLayout(ui, 'myhome_panzerpage.xml');
  const control = layout.control('lstEquip');
  const selection = sourceProps(ui, layout, 'myhome_panzerpage.xml', 'lstEquip', control.properties.SelectionImage);
  return <div {...sourceProps(ui, layout, 'myhome_panzerpage.xml', 'lstEquip')}
    className="home-equipment-list-scroll-shell">
    <div ref={list} className="home-equipment-source-list" role="listbox" aria-label="拥有装备"
      aria-busy={busy} data-home-equipment-list="" onMouseLeave={dismissDescription} onScroll={dismissDescription}
      onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) dismissDescription?.();}}>
      {entries.map((entry, index) => {
        const common = gameContent().items.get(entry.itemTableId)?.runtime.equipmentGroup === 'common';
        const hat = gameContent().items.get(entry.itemTableId)?.runtime.equipmentGroup === 'hat';
        const balloon = gameContent().items.get(entry.itemTableId)?.runtime.equipmentGroup === 'balloon';
        const mark = gameContent().items.get(entry.itemTableId)?.runtime.equipmentGroup === 'mark';
        const icon = sourceProps(ui, layout, 'myhome_panzerpage.xml', 'lstEquip',
          `set:daoju0 image:data\\ui\\daoju\\${String(entry.iconId).padStart(5, '0')}.tga`);
        const available = entry.bindingName === undefined && entry.ownedQuantity > 0;
        return <button key={entry.instanceId} type="button" role="option" disabled={busy || !available}
          draggable={!busy && available && tankInstanceId !== undefined}
          onDragStart={event => {
            if (busy || !available || tankInstanceId === undefined) {event.preventDefault(); return;}
            dismissDescription?.();
            select(entry.instanceId);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(dragType, `${tankInstanceId}:${entry.instanceId}`);
          }}
          data-equipment-item={entry.instanceId} data-home-equipment-common-row={common ? entry.instanceId : undefined} data-home-equipment-hat-mark-row={hat || balloon || mark ? entry.instanceId : undefined} aria-selected={selected === entry.instanceId}
          aria-pressed={selected === entry.instanceId}
          aria-describedby={described === entry.instanceId ? 'home-item-description' : undefined}
          style={selected === entry.instanceId ? {backgroundImage: selection.style.backgroundImage} : undefined}
          data-source-selection-asset={selected === entry.instanceId ? selection['data-source-asset'] : undefined}
          onMouseEnter={event => describe?.(entry, event.currentTarget)}
          onFocus={event => describe?.(entry, event.currentTarget)}
          onClick={() => select(entry.instanceId)} onKeyDown={event => {
            const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
              : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : undefined;
            if (next === undefined) return;
            event.preventDefault(); event.stopPropagation();
            const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
            let nextIndex = Math.max(0, Math.min(entries.length - 1, next));
            while (nextIndex >= 0 && nextIndex < entries.length
                && (entries[nextIndex].bindingName !== undefined || entries[nextIndex].ownedQuantity <= 0)) nextIndex += direction;
            const candidate = entries[nextIndex];
            if (!candidate) return;
            select(candidate.instanceId);
            const button = list.current?.querySelector<HTMLButtonElement>(`[data-equipment-item="${candidate.instanceId}"]`);
            button?.focus(); button?.scrollIntoView({block: 'nearest'});
          }} onKeyUp={event => {
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.stopPropagation();
          }}>
          {common || hat || balloon || mark ? <HomeEquipmentCommonRowContent ui={ui} name={entry.name} iconId={entry.iconId}
            itemTableId={entry.itemTableId} ownedQuantity={entry.ownedQuantity}
            installed={common || hat || balloon || mark ? entry.installed : undefined}
            kindLabel={isAppearanceEffectItem(entry.itemTableId) ? '外观特效' : hat ? '坦克帽子' : balloon ? '坦克气球' : mark ? '坦克标志' : undefined}/> : <>
          <span className="home-equipment-source-icon" style={{backgroundImage: icon.style.backgroundImage}}
            data-source-asset={icon['data-source-asset']} aria-hidden="true" />
          <span>{entry.name} ×{entry.ownedQuantity}</span></>}
          {entry.bindingName && <span className="home-equipment-binding">已装备：{entry.bindingName}</span>}
        </button>;
      })}
    </div>
    <HomeEquipmentListScrollbar list={list} ui={ui} properties={control.properties}/>
  </div>;
}
