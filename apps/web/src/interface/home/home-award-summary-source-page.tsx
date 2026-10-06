import './home-award-summary-source-page.css';
import type {AwardCounts} from '../../../../shared/protocols/PtlRoleProfile';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackStaticText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

const SUFFIX = 'myhome_playerpage_awardsummary.xml';
const COUNTERS: Record<string, keyof AwardCounts> = {
  txtPerfect: 'perfect', txtMVP: 'mvp', txtSavage: 'savage', txtConsole: 'console', txtBrave: 'brave',
  txtKind: 'kind', txtCrafty: 'crafty', txtShy: 'shy', txtGreedy: 'greedy',
};

/** Source artwork stays fixed; the nine counters bind to authoritative profile award counts. */
export function HomeAwardSummarySourcePage({ui, awards}: {ui: HomeSourceUi; awards?: AwardCounts}) {
  const layout = new HomeSourceLayout(ui, SUFFIX);
  const controls = ui.layouts.find(value => value.path.endsWith(SUFFIX))!.windows;
  return <section className="home-award-summary-source" data-home-award-summary="" aria-label="奖章">
    {controls.filter(control => control.type === 'WindowsLook/StaticImage').map(control =>
      <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={SUFFIX}
        name={control.name} aria-hidden="true" />)}
    <SourceImageScale value={1}>
      {controls.filter(control => control.type === 'WindowsLook/StaticText').map(control => {
        const field = COUNTERS[control.name];
        const value = field ? awards?.[field] : undefined;
        return (
        <SourceFeedbackStaticText key={control.name} ui={ui} layout={layout} suffix={SUFFIX}
          name={control.name} text={value === undefined ? '' : String(value)}
          data-home-award-counter={control.name} data-home-award-field={field}
          data-home-award-value={value}
          data-home-award-unbound={value === undefined ? '' : undefined} />);
      })}
    </SourceImageScale>
  </section>;
}
