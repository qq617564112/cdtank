import './home-award-summary-source-page.css';
import type {CSSProperties} from 'react';
import type {AwardCounts} from '../../../../shared/protocols/PtlRoleProfile';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {HomeStaticText as SourceFeedbackStaticText} from './home-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';

const SUFFIX = 'myhome_playerpage_awardsummary.xml';
const COUNTERS: Record<string, keyof AwardCounts> = {
  txtPerfect: 'perfect', txtMVP: 'mvp', txtSavage: 'savage', txtConsole: 'console', txtBrave: 'brave',
  txtKind: 'kind', txtCrafty: 'crafty', txtShy: 'shy', txtGreedy: 'greedy',
};

/** Source artwork stays fixed; the nine counters bind to authoritative profile award counts. */
export function HomeAwardSummarySourcePage({ui, awards, style}: {
  ui: HomeSourceUi; awards?: AwardCounts; style?: CSSProperties;
}) {
  const layout = new HomeSourceLayout(ui, SUFFIX);
  const controls = ui.layouts.find(value => value.path.endsWith(SUFFIX))!.windows;
  return <section className="home-award-summary-source" style={style} data-home-award-summary="" aria-label="奖章">
    <div className="home-summary-sheet" style={{top: 198}} aria-hidden="true"/>
    {controls.filter(control => control.type === 'WindowsLook/StaticImage' && !['SheetWindow', 'xiamiandeditu'].includes(control.name)).map(control =>
      <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={SUFFIX}
        name={control.name} aria-hidden="true" />)}
    <SourceImageScale value={1}>
      {controls.filter(control => control.type === 'WindowsLook/StaticText').map(control => {
        const field = COUNTERS[control.name];
        const value = field ? awards?.[field] : undefined;
        const picture = sourceProps(ui, layout, SUFFIX, control.parent!);
        return (
        <SourceFeedbackStaticText key={control.name} ui={ui} layout={layout} suffix={SUFFIX}
          name={control.name} text={value === undefined ? '' : String(value)}
          className="home-award-counter"
          style={{...picture.style, justifyContent: 'flex-end', alignItems: 'flex-end'}}
          data-home-award-counter={control.name} data-home-award-field={field}
          data-home-award-value={value}
          data-home-award-unbound={value === undefined ? '' : undefined} />);
      })}
    </SourceImageScale>
  </section>;
}
