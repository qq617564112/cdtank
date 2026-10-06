import {SourceStaticImage} from '../resources/source-static-image';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';

/** Source shop regions around the product model, attributes, parameters and balances. */
export function TankShopSourceRegions({ui}: {ui: HomeSourceUi}) {
  const suffix = 'shop_tankpage.xml';
  const layout = new HomeSourceLayout(ui, suffix);
  const pictures = [
    'heseditu', 'ditukuang', 'tankeshengjiqu', 'huangtiao5', 'fuhao2',
    'huangtiao4', 'lblPanzerSide', 'baifenbi3', 'huangtiao3', 'lblPanzerBack',
    'baifenbi4', 'hangditu2', 'hangditu1', 'huangtiao6', 'fuhao1',
    'shengyutianshu', 'huolidengji', 'zhuangjia', 'tankecanshuqu', 'hangditu8',
    'lblShootInterval', 'sec', 'huangditu7', 'lblMoveSpeed', 'km',
    'huangditu9', 'lblRotationSpeed', 'xiegangsec', 'huangtiao10', 'lblLoadingTime',
    'ditu', 'shuliangditu', 'changtiao', 'changtiao2', 'jinqiantubiao',
    'jinqian', 'chuangyidiantubiao2', 'xingbi',
  ];
  return <>{pictures.map(name => <SourceStaticImage key={name} ui={ui} layout={layout}
    suffix={suffix} name={name} className="tank-shop-source-picture" aria-hidden="true" />)}</>;
}
