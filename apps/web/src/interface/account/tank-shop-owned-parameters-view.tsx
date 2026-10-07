import {SourceFeedbackStaticText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import type {HomeTankParameters} from '../home/home-tank-parameters';

/** Shop-side control names for the five Home aggregate parameters, in source order. */
const OWNED_PARAMETER_FIELDS = [
  ['txtPanzerSide', 'txtPanzerSide'],
  ['txtPanzerBack', 'txtPanzerBack'],
  ['txtMoveSpeed', 'txtMoveSpeed'],
  ['txtRotateSpeed', 'txtRotationSpeed'],
  ['txtShootInterval', 'txtShootInterval'],
] as const;

/** Original Shop Owned mode parameter text; capacity progress has no mode1 setter. */
export function TankShopOwnedParametersView({ui, values}: {ui: HomeSourceUi; values?: HomeTankParameters}) {
  const suffix = 'shop_tankpage.xml', layout = new HomeSourceLayout(ui, suffix);
  return <div className="tank-shop-owned-parameters" data-tank-shop-owned-parameters="">
    {OWNED_PARAMETER_FIELDS.map(([name, key]) => <SourceFeedbackStaticText key={name}
      ui={ui} layout={layout} suffix={suffix} name={name}
      className="tank-shop-source-attribute" text={values ? String(values[key]) : ''}
      data-tank-owned-parameter={name} data-tank-owned-parameter-value={values?.[key]} />)}
  </div>;
}
