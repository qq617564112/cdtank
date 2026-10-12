import {useId, type ComponentPropsWithoutRef} from 'react';
import {GameSurfaceTexture} from '../resources/game-surface-texture';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {CartoonButtonArtwork} from '../resources/cartoon-button-artwork';
import {HomeCurrencyDot} from './home-currency-dot';
import './home-artwork.css';

type HomeMaterial = 'canvas' | 'header' | 'brown' | 'mint' | 'paper' | 'preview' | 'slot' | 'peach' | 'balance' | 'count';
interface HeaderTab {left: number; width: number; rise?: number; inset?: number;}

export const HOME_CANVAS_INSET = 12.5;

/** Torn edges are drawn at their native dimensions so corners keep their proportions. */
function clothContour(width: number, height: number, tab?: HeaderTab) {
  const top = [];
  for (const [index, fraction] of [.05, .13, .23, .38, .47, .64, .79, .92].entries()) {
    const x = width * fraction;
    if (tab && x > tab.left - 5 && x < tab.left + tab.width + 4) continue;
    top.push({x, path: `L${x - 3.2} ${1.5 + index % 3 * .4}
      L${x - 1.1} ${3.6 + index % 2 * 1.1}L${x + 1.3} ${3.1 + index % 3 * .5}
      L${x + 3.2} 1.8`});
  }
  if (tab) {
    const y = -(tab.rise ?? 28) + 1.4, x = tab.left, right = x + tab.width;
    top.push({x: x + 2, path: `L${x + 1.4} 1.8L${x + 1.6} ${y + 15.6}
      L${x + 3.8} ${y + 14.1}L${x + 1.5} ${y + 12.4}L${x + 1.3} ${y}
      L${x + 9} ${y - .3}L${x + 10.1} ${y + 2.6}L${x + 12.5} ${y + .3}
      L${x + tab.width * .36} ${y - .2}L${x + tab.width * .38} ${y + 2.2}
      L${x + tab.width * .42} ${y + .2}L${right - 13} ${y - .2}
      L${right - 11} ${y + 2.4}L${right - 8.5} ${y - .2}L${right - 1.5} ${y + .2}
      L${right - 1.6} ${y + 7.6}L${right - 4} ${y + 9.1}L${right - 1.7} ${y + 10.6}
      L${right - 1.5} ${y + 20.6}L${right - 3.8} ${y + 22.6}
      L${right - 1.6} ${y + 24.4}L${right - 1.7} 1.8`});
  }
  let path = `M1.4 1.8${top.sort((a, b) => a.x - b.x).map(item => item.path).join('')}
    L${width - 3} 2.1`;
  for (const [index, fraction] of [.11, .24, .40, .53, .71, .87].entries()) {
    const y = height * fraction;
    path += `L${width - 3 + index % 2 * .3} ${y - 2.5}
      L${width - 5.8} ${y - .9}L${width - 5.1} ${y + 1.2}L${width - 3} ${y + 2}`;
  }
  path += `L${width - 3.2} ${height - 2.1}`;
  for (const [index, fraction] of [.93, .78, .66, .49, .36, .21, .08].entries()) {
    const x = width * fraction;
    path += `L${x + 3.2} ${height - 2.3}L${x + 1.6} ${height - 4.6 + index % 2}
      L${x - .9} ${height - 3.9}L${x - 3.5} ${height - 2}`;
  }
  path += `L1.8 ${height - 2}`;
  for (const [index, fraction] of [.89, .73, .57, .43, .26, .09].entries()) {
    const y = height * fraction;
    path += `L${1.4 + index % 2 * .3} ${y + 2.3}L4.5 ${y + .8}
      L3.7 ${y - 1.1}L1.5 ${y - 2}`;
  }
  return `${path}Z`;
}

function insetContour(width: number, height: number, inset: number, tab?: HeaderTab) {
  const tabInset = tab?.inset ?? inset;
  return `M${inset} ${inset}
    ${tab ? `L${tab.left + tabInset} ${inset}L${tab.left + tabInset} ${-(tab.rise ?? 28) + tabInset}
      L${tab.left + tab.width - tabInset} ${-(tab.rise ?? 28) + tabInset}L${tab.left + tab.width - tabInset} ${inset}` : ''}
    L${width - inset} ${inset + .3}L${width - inset - .3} ${height * .38}
    L${width - inset + .1} ${height * .73}L${width - inset - .3} ${height - inset}
    L${width * .56} ${height - inset + .1}L${inset + .3} ${height - inset + .3}
    L${inset + .1} ${height * .61}L${inset + .3} ${height * .27}Z`;
}

const MATERIALS = {
  canvas: {tone: 'room-canvas', base: '#d07f5f', textureOpacity: 1},
  header: {tone: 'panel-gold', base: '#252e83', textureOpacity: .035},
  brown: {tone: 'panel-gold', base: '#947d52', textureOpacity: .1},
  mint: {tone: 'input-cream', base: '#d3f5c8', textureOpacity: .12},
  paper: {tone: 'input-cream', base: '#fffcd0', textureOpacity: .08},
  preview: {tone: 'player-paper', base: '#fff0bf', textureOpacity: .24},
  slot: {tone: 'player-paper', base: '#fff0bf', textureOpacity: .24},
  peach: {tone: 'sand', base: '#f1bb89', textureOpacity: .4},
  balance: {tone: 'walnut', base: '#5e210b', textureOpacity: .14},
  count: {tone: 'panel-gold', base: '#947d52', textureOpacity: .1},
} as const;

export function HomeSurfacePanel({material = 'canvas', headerTab, className = '', style, children, ...props}:
  ComponentPropsWithoutRef<'div'> & {material?: HomeMaterial; headerTab?: HeaderTab}) {
  const width = Number(style?.width);
  const height = Number(style?.height);
  const id = useId();
  const palette = MATERIALS[material];
  const rise = headerTab?.rise ?? 28;
  const textureSize = {width, height: height + (headerTab ? rise : 0)};
  const cloth = material === 'canvas' || material === 'header';
  const outer = cloth ? clothContour(width, height, headerTab)
    : headerTab ? insetContour(width, height, 1.4, headerTab)
    : material === 'peach' ? `M2 7Q1 2 7 2L${width - 8} 1.5Q${width - 2} 1 ${width - 2} 7
      L${width - 1} ${height - 7}Q${width - 1} ${height - 2} ${width - 7} ${height - 2}
      L8 ${height - 1.5}Q2 ${height - 1} 2 ${height - 7}Z`
    : material === 'count' ? `M1.7 1.2L${width - 62} 1Q${width - 59} 1 ${width - 59} 4
      L${width - 58} ${height - 7}Q${width - 57} ${height - 4} ${width - 54} ${height - 4}
      L${width - 8} ${height - 4}Q${width - 4} ${height - 4} ${width - 4} ${height - 8}
      L${width - 3} 1L${width - 1} 1L${width - 1} ${height - 1}L1 ${height - 1}Z`
    : `M1.7 1.4L${width - 3} 1Q${width - 1} 1 ${width - 1} 3
      L${width - 1.3} ${height - 2}Q${width - 2} ${height - .5} ${width - 4} ${height - 1}
      L2 ${height - .7}Q.8 ${height - 1} 1 ${height - 3}Z`;
  const previewFrame = material === 'preview' || material === 'slot';
  const framed = material === 'canvas' || previewFrame || material === 'peach';
  const face = framed ? insetContour(width, height, material === 'canvas' ? HOME_CANVAS_INSET : 3, headerTab) : outer;
  return <div {...props} className={`home-surface-panel ${className}`} style={style}
    data-home-surface={material} aria-hidden="true">
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" focusable="false">
      <GameSurfaceTexture id={`${id}-texture`} tone={palette.tone} size={textureSize}/>
      {material === 'canvas' && <GameSurfaceTexture id={`${id}-edge`} tone="room-edge" size={textureSize}/>}
      <defs>
        <pattern id={`${id}-face-fill`} href={`#${id}-texture`}
          patternTransform={headerTab ? `translate(0 -${rise})` : undefined}/>
        {material === 'canvas' && <pattern id={`${id}-edge-fill`} href={`#${id}-edge`}
          patternTransform={headerTab ? `translate(0 -${rise})` : undefined}/>}
        <filter id={`${id}-inset`} x="-10%" y="-20%" width="120%" height="140%"
          colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation={previewFrame ? 2.1 : material === 'paper' ? .8 : 1.15} result="soft"/>
          <feOffset in="soft" dx=".45" dy="1" result="lower"/>
          <feComposite in="SourceAlpha" in2="lower" operator="out" result="edge"/>
          <feFlood floodColor="#3e371d" floodOpacity={previewFrame ? .55 : material === 'paper' ? .16 : .25}/>
          <feComposite in2="edge" operator="in"/>
        </filter>
      </defs>
      <path d={outer} fill={material === 'canvas' ? `url(#${id}-edge-fill)` : palette.base}
        stroke={material === 'header' ? '#47365a' : cloth ? '#42501d' : 'none'}
        strokeWidth=".9" strokeLinejoin="round"/>
      {material === 'canvas' && <path d={insetContour(width, height, 9, headerTab)} fill="#947d52"/>}
      {previewFrame && <path d={outer} fill="#a39260"/>}
      {material === 'peach' && <path d={outer} fill="#a98557"/>}
      <path d={face} fill={palette.base}/>
      <path d={face} fill={`url(#${id}-face-fill)`} opacity={palette.textureOpacity}/>
      {material === 'canvas' && <g fill="#42501d" opacity=".65">
        {[.15, .33, .62, .83].map((fraction, index) => {
          const y = height * fraction;
          return <path key={fraction} d={`M1.6 ${y - 4}L4.3 ${y - 2}L3.2 ${y + 1}L6 ${y + 2}
            L5.5 ${y + 3.8}L1.7 ${y + 3}ZM${width - 3} ${y + 12}
            L${width - 6} ${y + 14}L${width - 5} ${y + 17 + index % 2}L${width - 3} ${y + 18}Z`}/>;
        })}
      </g>}
      {material === 'header' && <path d={`M4 4L${width - 6} 4L${width - 5} 8L4 7Z`}
        fill="#5b77b9" opacity=".7"/>}
      {material === 'peach' && <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M7 8L${width - 9} 7M7 ${height - 7}L${width - 8} ${height - 8}`}
          stroke="#fff1c7" strokeWidth="1.6" opacity=".85"/>
        {[.09, .23, .41, .59, .77, .92].map((fraction, index) => {
          const x = width * fraction;
          return <path key={fraction} d={`M${x - 14} 10l7 -1l-2 4l7 -1l3 -3l8 .5
            M${x - 12} ${height - 17}q9 2 17 -1l6 ${index % 2 ? -2 : 1}`}
            stroke="#9d7747" strokeWidth=".9" opacity=".48"/>;
        })}
        <path d={`M12 ${height * .53}Q${width * .24} ${height * .62} ${width * .43} ${height * .47}
          M${width * .62} ${height * .49}Q${width * .78} ${height * .41} ${width - 18} ${height * .55}`}
          stroke="#fce1b8" strokeWidth="1" opacity=".65"/>
      </g>}
      {material === 'preview' && <g fill="#aaa95c" opacity=".5">
        {[[36, 177, 20], [84, 161, -20], [83, 121, 12], [111, 94, -15],
          [174, 64, 22], [184, 27, -18]].map(([x, y, rotation], index) =>
          <g key={index} transform={`translate(${x} ${y}) rotate(${rotation})`}>
            <path d="M-8 7C-10 3-6 0-3-1C0-4 2-3 5-1C10 2 10 8 5 9C2 10-1 6-3 8C-5 10-8 10-8 7Z"/>
            <ellipse cx="-9" cy="-4" rx="3.1" ry="4.5" transform="rotate(-28 -9 -4)"/>
            <ellipse cx="-3" cy="-9" rx="3.2" ry="4.7"/>
            <ellipse cx="4" cy="-9" rx="3.1" ry="4.4" transform="rotate(17 4 -9)"/>
            <ellipse cx="10" cy="-3" rx="3" ry="4" transform="rotate(39 10 -3)"/>
          </g>)}
      </g>}
      <path d={face} fill="#000" filter={`url(#${id}-inset)`}/>
    </svg>
    {children}
  </div>;
}

const SURFACES: Record<string, HomeMaterial> = {
  anniuditu: 'header', hongsexiaodi: 'header', zkb: 'canvas', youbiandaditu: 'canvas',
  zhongjianheseditu: 'brown', heseditu: 'brown', heseditu2: 'brown', ditu: 'brown',
  chaotiaodi: 'peach', tankecanshuqu: 'mint', tankeshengjiqu: 'mint',
  ditukuang: 'preview', shuliangditu: 'count', shuliangtiao2: 'count',
  changtiao: 'balance', changtiao2: 'balance', jinqiantiao: 'balance', daibitiao: 'balance',
  huangtiao3: 'paper', huangtiao4: 'paper', huangtiao5: 'paper', huangtiao6: 'paper',
  huangtiao10: 'paper', huangditu7: 'paper', huangditu9: 'paper',
  hangditu1: 'paper', hangditu2: 'paper', hangditu8: 'paper', tankkemiaoshu: 'paper',
};

const LABELS: Record<string, string> = {
  jinqian: '金 钱', jinqian2: '金 钱', xingbi: '星 币', Qbi: '金币', huofeijinengdian: '创意点',
  chuangyidiantubiao: '创意点', lblPanzerSide: '侧面装甲', lblPanzerBack: '背面装甲',
  lblShootInterval: '发射间隔', lblMoveSpeed: '移动速度', lblRotationSpeed: '回旋速度',
  lblLoadBullet: '炮弹容量', shengyutianshu: '剩余天数',
  lblCritical: '凶猛', lblLucky: '好运', lblHP: '生命值', lblTank: '熟练度', cemianzhuangjia: '技 能',
  baifenbi3: '%', baifenbi4: '%', fuhao1: '% ＋', fuhao2: '% ＋', sec: 'sec', km: 'km/h', xiegangsec: '°/sec',
};

/** Source controls compose shared vector surfaces, icons and native font labels. */
export function HomeSourceSurface(props: ComponentPropsWithoutRef<typeof SourceStaticImage>) {
  const {ui, layout, suffix, name, className = '', offsetX = 0, offsetY = 0,
    reference, children, ...attributes} = props;
  if (['daibitubiao', 'jinqiantubiao2', 'jinqiantubiao'].includes(name) && !reference) {
    const place = sourceProps(ui, layout, suffix, name, undefined, offsetX, offsetY);
    return <span {...place} {...attributes} className={`home-currency-marker ${className}`}
      style={{...place.style, ...attributes.style}}>
      <HomeCurrencyDot tone={name === 'daibitubiao' ? 'blue' : 'gold'}/>
    </span>;
  }
  if (name === 'chuangyidiantubiao2' && !reference
      && ['myhome_petpage.xml', 'myhome_panzerpage.xml'].includes(suffix)) {
    const place = sourceProps(ui, layout, suffix, name, undefined, offsetX, offsetY);
    const pet = suffix === 'myhome_petpage.xml';
    return <span {...place} {...attributes} className={`home-currency-marker ${className}`}
      style={{...place.style, ...attributes.style}}>
      {pet ? <svg className="home-currency-dot" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M11.7 1.1L3.5 7.2L7.4 7.4L1.2 14.7L10.6 9L7.6 8.7L14.3 1.6Z"
          fill="#ffdd00" stroke="#987509" strokeWidth=".8" strokeLinejoin="round"/>
        <path d="M11.3 2.2L5.1 6.8L8.1 6.9L3.8 12L10 8.7L7.2 8.4L12.5 2.1Z" fill="#fff673"/>
      </svg> : <HomeCurrencyDot tone="pearl"/>}
    </span>;
  }
  if (name === 'hangditu8' && suffix === 'myhome_petpage.xml' && !reference) {
    const place = sourceProps(ui, layout, suffix, name, undefined, offsetX, offsetY);
    return <HomeSurfacePanel {...place} {...attributes} material="paper" className={`home-pet-mastery ${className}`}
      style={{...place.style, ...attributes.style}}>
      {['轻坦克', '中坦克', '重坦克', '突击炮'].map((label, index) =>
        <span key={label} className="home-pet-mastery-label"
          style={{left: index % 2 ? 118 : 5, top: index < 2 ? 6 : 32}}>{label}</span>)}
    </HomeSurfacePanel>;
  }
  if (LABELS[name] && !reference) {
    const place = sourceProps(ui, layout, suffix, name, undefined, offsetX, offsetY);
    const currency = ['jinqian', 'jinqian2', 'xingbi', 'Qbi', 'chuangyidiantubiao', 'huofeijinengdian'].includes(name);
    const skillPoints = (name === 'chuangyidiantubiao' && suffix === 'myhome_petpage.xml')
      || (name === 'huofeijinengdian' && suffix === 'myhome_petpage_skill.xml');
    const label = skillPoints ? '技能点' : LABELS[name];
    const tone = !currency ? 'olive' : skillPoints ? 'skill' : name === 'xingbi' ? 'blue'
      : name === 'chuangyidiantubiao' || name === 'huofeijinengdian' ? 'green' : 'gold';
    return <span {...place} {...attributes} className={`home-painted-label ${className}`}
      data-home-label-tone={tone}
      style={{...place.style, ...attributes.style}}>{label}</span>;
  }
  if (name === 'picAlreadyUsed') {
    const place = sourceProps(ui, layout, suffix, name, undefined, offsetX, offsetY);
    return <div {...place} {...attributes} className={`cartoon-button game-button home-button ${className}`}
      data-home-button="use" data-home-state="current" style={{...place.style, ...attributes.style}}>
      <CartoonButtonArtwork width={Number(place.style.width)} shape="slab" gradient/>
      <span className="cartoon-control-label">出击中</span>
    </div>;
  }
  const material = SURFACES[name];
  if (!material || reference || children) return <SourceStaticImage {...props}/>;
  const place = sourceProps(ui, layout, suffix, name, undefined, offsetX, offsetY);
  if (name === 'hongsexiaodi' && ['myhome.xml', 'shop.xml'].includes(suffix)) {
    const panel = sourceProps(ui, layout, suffix, 'youbiandaditu', undefined, offsetX, offsetY).style;
    place.style.width = Number(panel.left) + Number(panel.width) - Number(place.style.left);
  }
  const roleTab = name === 'heseditu' && (suffix === 'myhome_petpage.xml' ? 'rdoPetPage'
    : suffix === 'myhome_panzerpage.xml' ? 'rdoTankPage' : undefined);
  const tab = roleTab ? sourceProps(ui, new HomeSourceLayout(ui, 'myhome.xml'), 'myhome.xml',
    roleTab, undefined, offsetX, offsetY).style : undefined;
  return <HomeSurfacePanel {...place} {...attributes} material={material} className={className}
    headerTab={tab ? {left: Number(tab.left) - Number(place.style.left), width: Number(tab.width),
      rise: Number(place.style.top) - Number(tab.top), inset: HOME_CANVAS_INSET} : undefined}
    style={{...place.style, ...attributes.style}}/>;
}
