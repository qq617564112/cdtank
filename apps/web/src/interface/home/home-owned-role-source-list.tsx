import {HomeOwnedPetRowContent} from './home-owned-pet-row-content';
import {HomeOwnedTankRowContent} from './home-owned-tank-row-content';
import {useRef} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {HomeOwnedRoleListScrollbar} from './home-owned-role-list-scrollbar';
import './home-owned-role-source-list.css';

export interface HomeOwnedRoleListEntry {instanceId: number; name: string; tankId?: number; tankType?: number; durationMinutes?: number; petId?: number; petType?: number; petSize?: number;}

/** Confirmed role identity and existing selection surround the source list pictures. */
export function HomeOwnedRoleSourceList({ui, kind, entries, selected, current, busy, select}: {
  ui: HomeSourceUi; kind: 'tank' | 'pet'; entries: readonly HomeOwnedRoleListEntry[];
  selected?: number; current?: number; busy: boolean; select(instanceId: number): void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const suffix = kind === 'tank' ? 'myhome_panzerpage.xml' : 'myhome_petpage.xml';
  const source = kind === 'tank' ? 'lstTank' : 'lstPet';
  const layout = new HomeSourceLayout(ui, suffix);
  const control = layout.control(source);
  const selection = sourceProps(ui, layout, suffix, source, control.properties.SelectionImage);
  return <div {...sourceProps(ui, layout, suffix, source)} className="home-owned-role-list-scroll-shell">
    <div ref={list} className="home-owned-role-source-list" role="listbox"
      aria-label={kind === 'tank' ? '拥有战车' : '拥有宠物'} aria-busy={busy} data-home-owned-role-list={kind}>
      {entries.map((entry, index) => <button key={entry.instanceId} type="button" role="option"
        data-owned-role={entry.instanceId} data-home-owned-tank-row={kind === 'tank' ? entry.instanceId : undefined} data-home-owned-pet-row={kind === 'pet' ? entry.instanceId : undefined} disabled={busy} aria-selected={selected === entry.instanceId}
        aria-pressed={selected === entry.instanceId}
        style={selected === entry.instanceId ? {backgroundImage: selection.style.backgroundImage} : undefined}
        data-source-selection-asset={selected === entry.instanceId ? selection['data-source-asset'] : undefined}
        onClick={() => select(entry.instanceId)} onKeyDown={event => {
          const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
            : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : undefined;
          if (next === undefined) return;
          event.preventDefault(); event.stopPropagation();
          const candidate = entries[Math.max(0, Math.min(entries.length - 1, next))];
          select(candidate.instanceId);
          const button = list.current?.querySelector<HTMLButtonElement>(`[data-owned-role="${candidate.instanceId}"]`);
          button?.focus(); button?.scrollIntoView({block: 'nearest'});
        }} onKeyUp={event => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.stopPropagation();
        }}>
        {kind === 'tank' ? <HomeOwnedTankRowContent ui={ui} name={entry.name} tankId={entry.tankId}
          tankType={entry.tankType} durationMinutes={entry.durationMinutes}/> : <HomeOwnedPetRowContent ui={ui} name={entry.name}
          petId={entry.petId} petType={entry.petType} petSize={entry.petSize}/>}
      </button>)}
    </div>
    <HomeOwnedRoleListScrollbar list={list} ui={ui} properties={control.properties}/>
  </div>;
}
