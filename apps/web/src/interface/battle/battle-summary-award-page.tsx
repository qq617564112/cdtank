import './battle-summary-award-page.css';
import type {ResultAward} from '../../../../shared/protocols';
import {SourceStaticImage} from '../resources/source-static-image';
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
export function BattleSummaryAwardPage({ui, award}: {
  ui: HomeSourceUi; award: ResultAward;
}) {
  const layout = new HomeSourceLayout(ui, SUFFIX);
  return <div className="battle-summary-award" data-summary-award="" role="status" aria-label="本局奖励">
    <div className="battle-summary-award-stage">
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
    </div>
  </div>;
}
