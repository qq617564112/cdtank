import './home-title-summary-source-page.css';
import {useRef} from 'react';
import type {AccountTitles} from '../../../../shared/protocols/PtlRoleProfile';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';

const SUFFIX = 'myhome_playerpage_titlesummary.xml';

/** Owned titles render at the original lstTitles geometry; selection is server-confirmed. */
export function HomeTitleSummarySourcePage({ui, titles, pending, status, select}: {
  ui: HomeSourceUi; titles?: AccountTitles; pending: boolean; status: string; select(titleId: number): void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const layout = new HomeSourceLayout(ui, SUFFIX);
  const control = layout.control('lstTitles');
  const selection = sourceProps(ui, layout, SUFFIX, 'lstTitles', control.properties.SelectionImage);
  const owned = titles?.owned ?? [], selectedId = titles?.selectedTitleId ?? 0;
  return <section className="home-title-summary-source" data-home-title-summary="" aria-label="拥有称号">
    <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="SheetWindow" aria-hidden="true" />
    <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="bg" aria-hidden="true" />
    <SourceImageScale value={1}>
      <div {...sourceProps(ui, layout, SUFFIX, 'lstTitles')} className="home-title-summary-list-shell">
        <div ref={list} className="home-title-summary-list" role="listbox" aria-label="拥有称号清单"
          aria-busy={pending} data-home-title-list="" data-title-count={owned.length}>
          {owned.map((title, index) => <button key={title.id} type="button" role="option"
            data-home-title-id={title.id} aria-selected={selectedId === title.id}
            data-source-selection-asset={selectedId === title.id ? selection['data-source-asset'] : undefined}
            style={selectedId === title.id ? {backgroundImage: selection.style.backgroundImage} : undefined}
            onClick={() => select(title.id)} onKeyDown={event => {
              const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
                : event.key === 'Home' ? 0 : event.key === 'End' ? owned.length - 1 : undefined;
              if (next === undefined) return;
              event.preventDefault(); event.stopPropagation();
              const candidate = owned[Math.max(0, Math.min(owned.length - 1, next))];
              list.current?.querySelector<HTMLButtonElement>(`[data-home-title-id="${candidate.id}"]`)?.focus();
            }} onKeyUp={event => {
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.stopPropagation();
            }}>
            <span className="home-title-name" data-home-title-name="">{title.name}</span>
            <span className="home-title-description" data-home-title-description="">{title.description}</span>
          </button>)}
        </div>
      </div>
    </SourceImageScale>
    <button type="button" className="home-title-clear" data-home-title-clear="" disabled={pending || !titles}
      onClick={() => select(0)}>清空称号</button>
    <output role="status" className="home-title-status" data-home-title-status="" aria-live="polite">{status}</output>
  </section>;
}
