import './battle-summary-award-page.css';
import type {ResultAward} from '../../../../shared/protocols';
import {HomeCurrencyDot} from '../home/home-currency-dot';
import {sourceProps} from '../resources/source-ui-props';
import {SummaryReceiptArtwork} from './battle-summary-artwork';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

const SUFFIX = 'game_summary_award.xml';
/** Source labels stay fixed; only the four awarded numbers come from the authority receipt. */
const FIELDS = [
  {label: 'lblMoney', value: 'txtMoney', field: 'money', text: '金钱'},
  {label: 'lblCoin', value: 'txtCoin', field: 'coin', text: '星币'},
  {label: 'lblOriginality', value: 'txtOriginality', field: 'originality', text: '创意点'},
  {label: 'lblTech', value: 'txtTech', field: 'tech', text: '技能点'},
] as const;

/** UI-20 sheet: the original award dialog consumes the local account's frozen receipt. */
export function BattleSummaryAwardPage({ui, award}: {
  ui: HomeSourceUi; award: ResultAward;
}) {
  const layout = new HomeSourceLayout(ui, SUFFIX);
  return <div className="battle-summary-award" data-summary-award="" role="status" aria-label="本局奖励">
    <div className="battle-summary-award-stage">
      <SummaryReceiptArtwork style={sourceProps(ui, layout, SUFFIX, 'wndDialog').style}/>
      {(['pic', 'daibitubiao'] as const).map((name, index) => <span key={name}
        {...sourceProps(ui, layout, SUFFIX, name)} className="battle-summary-award-symbol">
        <HomeCurrencyDot tone={index === 0 ? 'gold' : 'blue'}/>
      </span>)}
      <svg {...sourceProps(ui, layout, SUFFIX, 'chuangyidian')} viewBox="0 0 12 15" aria-hidden="true" focusable="false">
        <path d="M4 1L8 1L10 5L8 10H4L2 5Z" fill="#f8e978" stroke="#664a20" strokeWidth="1"/>
        <path d="M4 11H8M4 13H8M5 14H7" stroke="#c8b9aa" strokeWidth="1.5"/>
        <path d="M6 4V9" stroke="#fffdd7"/>
      </svg>
      <svg {...sourceProps(ui, layout, SUFFIX, 'jinengdian')} viewBox="0 0 16 15" aria-hidden="true" focusable="false">
        <path d="M6 1H10V4L13 3L15 6L12 8L15 10L13 13L10 11V14H6V11L3 13L1 10L4 8L1 6L3 3L6 4Z"
          fill="#dcddcc" stroke="#6b6347" strokeWidth=".8"/>
        <circle cx="8" cy="7.5" r="2.6" fill="#a09756" stroke="#fffde1"/>
      </svg>
      {FIELDS.map(({label, value, field, text}) => <span key={label} className="battle-summary-award-line">
        <span {...sourceProps(ui, layout, SUFFIX, label)} className="battle-summary-award-label">{text}</span>
        <span {...sourceProps(ui, layout, SUFFIX, value)} className="battle-summary-award-number battle-pixel-number"
          data-summary-award-field={field}>{award[field]}</span>
      </span>)}
    </div>
  </div>;
}
