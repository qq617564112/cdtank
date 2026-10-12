import type {HomeSourceUi} from '../resources/source-ui-layout';
import type {HomeTankParameters} from '../home/home-tank-parameters';
import {ShopTankParameters} from './shop-tank-stat-row';

/** Original Shop Owned mode parameter text; capacity progress has no mode1 setter. */
export function TankShopOwnedParametersView({ui, values}: {ui: HomeSourceUi; values?: HomeTankParameters}) {
  return <div className="tank-shop-owned-parameters" data-tank-shop-owned-parameters="">
    <ShopTankParameters ui={ui} owned values={values ? {...values, txtRotateSpeed: values.txtRotationSpeed} : undefined}/>
  </div>;
}
