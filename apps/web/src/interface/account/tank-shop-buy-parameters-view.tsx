import {SourceFeedbackStaticText, SourceFeedbackText} from '../resources/source-feedback-text';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {TANK_SHOP_BUY_PARAMETERS} from './tank-shop-buy-parameters';

/** Selected sale product uses the original buy-page parameter projection. */
export function TankShopBuyParametersView({ui, tankId}: {ui: HomeSourceUi; tankId: number}) {
  const values = TANK_SHOP_BUY_PARAMETERS[tankId];
  if (!values) return null;
  const suffix = 'shop_tankpage.xml', layout = new HomeSourceLayout(ui, suffix);
  const control = layout.control('prgLoadingTime');
  const background = sourceProps(ui, layout, suffix, 'prgLoadingTime', control.properties.BackgroundImage);
  const fill = sourceProps(ui, layout, suffix, 'prgLoadingTime', control.properties.ProgressImage);
  const width = Number(background.style.width), height = Number(background.style.height);
  const extent = Math.floor(width * values.progress + .5);
  return <div className="tank-shop-buy-parameters" data-tank-buy-parameters="" data-tank-id={tankId}
    data-parameter-binding="original-shop-buy-tank-table">
    {(['txtAttackLevel', 'txtPanzerLevel', 'txtMoveSpeed', 'txtRotateSpeed', 'txtShootInterval'] as const)
      .map(name => <SourceFeedbackStaticText key={name} ui={ui} layout={layout} suffix={suffix} name={name}
        text={String(values[name])} className="tank-shop-source-attribute"
        data-tank-buy-field={name} data-tank-buy-value={values[name]}
        title={name === 'txtShootInterval' ? '商品目录的发射间隔修正，实战间隔还由炮弹和装备合成。' : undefined} />)}
    <div {...background} className="tank-shop-buy-capacity" data-tank-buy-capacity=""
      data-capacity={values.capacity} data-progress={values.progress}
      data-count-binding="web-readout-of-original-shop-capacity"
      role="meter" aria-label="商品炮弹容量" aria-valuemin={0} aria-valuemax={6} aria-valuenow={values.capacity}>
      <span aria-hidden="true" style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${width - extent}px 0 0)`,
        width, height, backgroundImage: fill.style.backgroundImage, backgroundSize: '100% 100%'}} />
      <span className="tank-shop-buy-capacity-count"><SourceFeedbackText text={String(values.capacity)} colour="#253740" /></span>
    </div>
  </div>;
}
