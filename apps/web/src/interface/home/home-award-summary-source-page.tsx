import './home-award-summary-source-page.css';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceFeedbackStaticText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

const SUFFIX = 'myhome_playerpage_awardsummary.xml';

/** Source artwork is independent of the unavailable authoritative award counters. */
export function HomeAwardSummarySourcePage({ui}: {ui: HomeSourceUi}) {
  const layout = new HomeSourceLayout(ui, SUFFIX);
  const controls = ui.layouts.find(value => value.path.endsWith(SUFFIX))!.windows;
  return <section className="home-award-summary-source" data-home-award-summary="" aria-label="奖章">
    {controls.filter(control => control.type === 'WindowsLook/StaticImage').map(control =>
      <SourceStaticImage key={control.name} ui={ui} layout={layout} suffix={SUFFIX}
        name={control.name} aria-hidden="true" />)}
    <SourceImageScale value={1}>
      {controls.filter(control => control.type === 'WindowsLook/StaticText').map(control =>
        <SourceFeedbackStaticText key={control.name} ui={ui} layout={layout} suffix={SUFFIX}
          name={control.name} text="" data-home-award-counter={control.name} data-home-award-unbound="" />)}
    </SourceImageScale>
  </section>;
}
