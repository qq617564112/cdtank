import {HomeSymbolMeter} from '../home/home-symbol-meter';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {TANK_SHOP_BUY_PARAMETERS} from './tank-shop-buy-parameters';
import {TANK_SHOP_SOURCE_ATTRIBUTES} from './tank-shop-source-attributes';
import {ShopTankParameters} from './shop-tank-stat-row';

/** Selected sale product uses the original buy-page parameter projection. */
export function TankShopBuyParametersView({ui, tankId}: {ui: HomeSourceUi; tankId?: number}) {
  const values = TANK_SHOP_BUY_PARAMETERS[tankId!];
  const suffix = 'shop_tankpage.xml', layout = new HomeSourceLayout(ui, suffix);
  const background = sourceProps(ui, layout, suffix, 'prgLoadingTime');
  const width = Number(background.style.width), height = Number(background.style.height);
  const extent = Math.floor(width * (values?.progress ?? 0) + .5);
  return <div className="tank-shop-buy-parameters" data-tank-buy-parameters="" data-tank-id={tankId}
    data-parameter-binding="original-shop-buy-tank-table">
    <ShopTankParameters ui={ui} values={{...TANK_SHOP_SOURCE_ATTRIBUTES[tankId!], ...values}}/>
    <div {...background} className="tank-shop-buy-capacity" data-tank-buy-capacity=""
      data-capacity={values?.capacity} data-progress={values?.progress}
      role="meter" aria-label="商品炮弹容量" aria-valuemin={0} aria-valuemax={6} aria-valuenow={values?.capacity}>
      <HomeSymbolMeter kind="shells" width={width} height={height} extent={extent}/>
    </div>
  </div>;
}
