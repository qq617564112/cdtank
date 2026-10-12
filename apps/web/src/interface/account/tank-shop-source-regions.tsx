import {ShopOwnedPanel, ShopSourceBackground as SourceStaticImage} from './shop-source-background';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** Source shop regions around the product model, attributes, parameters and balances. */
export function TankShopSourceRegions({ui, tab}: {ui: HomeSourceUi; tab: 'rdoBuy' | 'rdoSell' | 'rdoTexture'}) {
  const suffix = 'shop_tankpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = [
    'heseditu', 'ditukuang', 'tankeshengjiqu', 'huangtiao5',
    'huangtiao4', 'huangtiao3', 'hangditu2', 'hangditu1', 'huangtiao6',
    'shengyutianshu', 'tankecanshuqu', 'hangditu8',
    'huangditu7', 'huangditu9', 'huangtiao10', 'lblLoadingTime',
    'ditu', 'shuliangditu', 'changtiao', 'changtiao2', 'jinqiantubiao',
    'jinqian', 'chuangyidiantubiao2', 'xingbi',
  ];
  return <><ShopOwnedPanel ui={ui} suffix={suffix} tab={tab}/>{pictures.map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
    suffix={suffix} name={name} className="tank-shop-source-picture" aria-hidden="true" />)}</>;
}
