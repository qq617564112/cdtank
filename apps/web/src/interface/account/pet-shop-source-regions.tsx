import {ShopOwnedPanel, ShopSourceBackground as SourceStaticImage} from './shop-source-background';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** Original product regions around the pet model, attributes and balances. */
export function PetShopSourceRegions({ui, tab}: {ui: HomeSourceUi; tab: 'rdoBuy' | 'rdoSell'}) {
  const suffix = 'shop_petpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = [
    'heseditu', 'ditukuang', 'tankeshengjiqu', 'huangtiao5', 'lblCritical',
    'lblLucky', 'cemianzhuangjia', 'hangditu2', 'huangtiao6', 'lblHP',
    'tankecanshuqu', 'hangditu8', 'lblTank', 'ditu', 'shuliangditu',
    'changtiao', 'changtiao2', 'jinqiantubiao', 'jinqian', 'chuangyidiantubiao2',
    'xingbi',
  ];
  return <><ShopOwnedPanel ui={ui} suffix={suffix} tab={tab}/>{pictures.map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
    suffix={suffix} name={name} className="pet-shop-source-picture" aria-hidden="true" />)}</>;
}
