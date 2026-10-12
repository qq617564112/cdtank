import type {ComponentProps} from 'react';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {HOME_CANVAS_INSET, HomeSourceSurface, HomeSurfacePanel} from '../home/home-surface';
import {HomeCurrencyDot} from '../home/home-currency-dot';
import {GameCurrencyBoard} from '../resources/game-currency-board';
import './shop-hd.css';

const LABELS: Record<string, string> = {
  lblLoadingTime: '装弹修正',
  xingdian1: '星 币', xingdian2: '星 币', xingdian3: '星 币',
  yongxingbibaoyang: '用星币保养', yongxingbibaoyang2: '用星币保养', yongxingbibaoyang3: '用星币保养',
  yongjinqianbaoyang1: '用金钱保养', yongjinqianbaoyang2: '用金钱保养', yongjinqianbaoyang3: '用金钱保养',
  baoyang1tian: '保养1天', baoyang1tian2: '保养1天', baoyang7tian: '保养7天', baoyang7tian2: '保养7天',
  baoyang30tian: '保养30天', baoyang30tian2: '保养30天',
};

/** Shop decoration shares the player sheet's vector surfaces and native labels. */
export function ShopSourceBackground({ui, layout, suffix, name, className = '', children,
  offsetX = 0, offsetY = 0, reference, ...props}:
  ComponentProps<typeof SourceStaticImage>) {
  const position = sourceProps(ui, layout, suffix, name, undefined, offsetX, offsetY);
  const style = {...position.style, ...props.style};
  const attributes = {...position, ...props, style, className: `shop-source-background ${className}`};
  if (/^shop_(?:item|part|tank|pet|mend)page\.xml$/.test(suffix)) {
    if (['ditu', 'changtiao', 'changtiao2'].includes(name)) return null;
    if (name === 'shuliangditu') return <GameCurrencyBoard {...attributes}
      className={`shop-source-background ${className}`}
      style={{...style, left: 7, top: 330, width: 200, height: 63}}/>;
  }
  if (/^(?:Qbi\d*|yongdaibibaoyang\d*)$/.test(name)) return null;
  const blueDot = name === 'chuangyidiantubiao2' || /^daibitubiao\d*$/.test(name)
    || /^tubiao[1-3]$/.test(name);
  if (blueDot || /^jinqiantubiao\d*$/.test(name) || /^tubiao[4-6]$/.test(name)) {
    return <span {...attributes} className={`shop-currency-marker ${className}`}>
      <HomeCurrencyDot tone={blueDot ? 'blue' : 'gold'}/>
    </span>;
  }
  const label = LABELS[name] ?? (/^jinqian\d+$/.test(name) ? '金 钱' : /^xingbi\d+$/.test(name) ? '星 币' : undefined);
  if (label) return <span {...attributes} className={`home-painted-label shop-painted-label ${className}`}
    data-home-label-tone={/^jinqian/.test(name) ? 'gold' : /^xing(?:bi|dian)/.test(name) ? 'blue' : undefined}
    data-shop-label={name}>{label}</span>;
  if (suffix === 'shop_tankpage_part.xml' && /^bg(?:Hat|Mark|InternalPart|ExternalPart)/.test(name)) {
    return <HomeSurfacePanel {...attributes} material="slot"/>;
  }
  if (name === 'shuliangditu' || /^tiao[1-3]$/.test(name)) {
    return <HomeSurfacePanel {...attributes} material={name === 'shuliangditu' ? 'brown' : 'mint'}/>;
  }
  if (name === 'heseditu' && ['shop_petpage.xml', 'shop_tankpage.xml'].includes(suffix)) {
    const root = new HomeSourceLayout(ui, 'shop.xml');
    const tab = sourceProps(ui, root, 'shop.xml', suffix === 'shop_petpage.xml' ? 'rdoPetPage' : 'rdoTankPage').style;
    return <HomeSurfacePanel {...attributes} material="brown" headerTab={{
      left: Number(tab.left) - Number(style.left), width: Number(tab.width),
      rise: Number(style.top) - Number(tab.top), inset: HOME_CANVAS_INSET,
    }}/>;
  }
  if (suffix === 'shop_petpage.xml' && name === 'hangditu8') {
    return <HomeSurfacePanel {...attributes} material="paper">
      {['轻坦克', '中坦克', '重坦克', '突击炮'].map((text, index) =>
        <span key={text} className="shop-mastery-label" style={{left: index % 2 ? 116 : 3, top: index < 2 ? 4 : 30}}>{text}</span>)}
    </HomeSurfacePanel>;
  }
  return <HomeSourceSurface ui={ui} layout={layout} suffix={suffix} name={name}
    offsetX={offsetX} offsetY={offsetY} reference={reference}
    {...props} className={`shop-source-background ${className}`}>{children}</HomeSourceSurface>;
}

/** The selected inventory tab and canvas share one continuous contour. */
export function ShopOwnedPanel({ui, suffix, tab}: {ui: HomeSourceUi; suffix: string; tab: string}) {
  const root = new HomeSourceLayout(ui, 'shop.xml');
  const position = sourceProps(ui, root, 'shop.xml', 'zkb');
  const selected = sourceProps(ui, new HomeSourceLayout(ui, suffix), suffix, tab).style;
  return <HomeSurfacePanel {...position} className="shop-source-background shop-owned-panel" headerTab={tab === 'rdoMyMarkPage' ? undefined : {
    left: Number(selected.left) - Number(position.style.left), width: Number(selected.width),
    rise: Number(position.style.top) - Number(selected.top),
  }}/>;
}
