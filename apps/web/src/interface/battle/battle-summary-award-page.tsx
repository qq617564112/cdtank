import './battle-summary-award-page.css';
import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import type {ResultAward} from '../../../../shared/protocols';
import {SourceStaticImage, SourceImageScale} from '../resources/source-static-image';
import {SourceStaticText} from '../resources/source-static-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

const SUFFIX = 'game_summary_award.xml';
const ICONS = ['pic', 'daibitubiao', 'chuangyidian', 'jinengdian'];
/** Source labels stay fixed; only the four awarded numbers come from the authority receipt. */
const FIELDS = [
  {label: 'lblMoney', value: 'txtMoney', field: 'money', text: '金钱'},
  {label: 'lblCoin', value: 'txtCoin', field: 'coin', text: '星币'},
  {label: 'lblOriginality', value: 'txtOriginality', field: 'originality', text: '创意点'},
  {label: 'lblTech', value: 'txtTech', field: 'tech', text: '技能点'},
] as const;

/** UI-20 sheet: the original award dialog consumes the local account's frozen receipt. */
export function BattleSummaryAwardPage({ui, award, close}: {ui: HomeSourceUi; award: ResultAward; close(): void}) {
  const layout = new HomeSourceLayout(ui, SUFFIX);
  const dialog = useRef<HTMLDialogElement>(null);
  const escapePending = useRef(false);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  useEffect(() => {
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const active = document.activeElement;
    const origin = active instanceof HTMLElement && active !== document.body ? active : null;
    if (!element.open) element.showModal();
    element.querySelector<HTMLButtonElement>('[data-summary-award-close]')?.focus();
    return () => {
      if (element.open) element.close();
      if (origin?.isConnected) origin.focus();
    };
  }, []);
  const keydown = (event: KeyboardEvent<HTMLDialogElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing || event.keyCode === 229) {event.preventDefault(); return;}
    if (event.key === 'Escape') {event.preventDefault(); escapePending.current = true;}
    else if (event.key === 'Enter') {event.preventDefault(); close();}
  };
  return <dialog ref={dialog} className="battle-summary-award" data-summary-award="" aria-label="本局奖励"
    onCancel={event => {event.preventDefault(); close();}}
    onKeyDown={keydown}
    onKeyUp={event => {
      event.stopPropagation();
      if (event.key === 'Escape' && escapePending.current) {
        escapePending.current = false;
        if (!event.nativeEvent.isComposing) close();
      }
    }}>
    <div className="battle-summary-award-stage" style={{zoom: scale}}>
      <SourceImageScale value={scale}>
        <SourceStaticImage ui={ui} layout={layout} suffix={SUFFIX} name="wndDialog"
          className="battle-summary-award-picture" aria-hidden="true" />
        {ICONS.map(name => <SourceStaticImage key={name} ui={ui} layout={layout} suffix={SUFFIX} name={name}
          className="battle-summary-award-picture" aria-hidden="true" />)}
        {FIELDS.map(({label, value, field, text}) => <span key={label} className="battle-summary-award-line">
          <SourceStaticText ui={ui} layout={layout} suffix={SUFFIX} name={label} text={text}
            className="battle-summary-award-label" />
          <SourceStaticText ui={ui} layout={layout} suffix={SUFFIX} name={value} text={String(award[field])}
            className="battle-summary-award-number" data-summary-award-field={field} />
        </span>)}
      </SourceImageScale>
      <button type="button" className="battle-summary-award-close" data-summary-award-close=""
        aria-label="关闭奖励" onClick={close}>关闭奖励</button>
    </div>
  </dialog>;
}
