import {imageResourceUrl} from '../../assets/image-cache';
import {useId, type CSSProperties} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {HOME_PLAYER_PREVIEW_CONTOUR} from './home-player-preview-contour';
import {HOME_CANVAS_INSET} from './home-surface';
import {GameCurrencyBoard} from '../resources/game-currency-board';

/** The information sheet leaves all labels and confirmed values to HTML. */
export function HomePlayerProfileBackground({ui}: {ui: HomeSourceUi}) {
  const layout = new HomeSourceLayout(ui, 'myhome_playerpage.xml');
  const bounds = sourceProps(ui, layout, 'myhome_playerpage.xml', 'tankeshengjiqu');
  const tab = sourceProps(ui, new HomeSourceLayout(ui, 'myhome.xml'), 'myhome.xml', 'rdoPlayerPage').style;
  const tabLeft = Number(tab.left) - Number(bounds.style.left) + HOME_CANVAS_INSET;
  const tabRight = tabLeft + Number(tab.width) - HOME_CANVAS_INSET * 2;
  const tabTop = Number(tab.top) - Number(bounds.style.top) + HOME_CANVAS_INSET;
  return <div {...bounds} className="home-player-profile-background" aria-hidden="true">
    <HomePlayerProfileArtwork headerTab={{left: tabLeft, right: tabRight, top: tabTop}}/>
  </div>;
}

/** The shared paper, portrait recess and score strip fit the native player card. */
export function HomePlayerProfileArtwork({headerTab}: {
  headerTab?: {left: number; right: number; top: number;};
}) {
  const id = useId();
  const top = headerTab
    ? `M${headerTab.left} 4L${headerTab.left} ${headerTab.top}L${headerTab.right} ${headerTab.top}L${headerTab.right} 2`
    : 'M2 4L38 3L76 4';
  return <svg viewBox="0 0 379 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-paper`} x2="0" y2="1">
        <stop stopColor="#fff4cb"/><stop offset="1" stopColor="#eed39a"/>
      </linearGradient>
      <linearGradient id={`${id}-preview`} x2="0" y2="1">
        <stop stopColor="#aa5941"/><stop offset=".12" stopColor="#c87957"/>
        <stop offset="1" stopColor="#e6b27e"/>
      </linearGradient>
      <filter id={`${id}-inner`}>
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.8" result="soft"/>
        <feOffset in="soft" dy="2" result="lower"/>
        <feComposite in="SourceAlpha" in2="lower" operator="out" result="rim"/>
        <feFlood floodColor="#654026" floodOpacity=".6"/>
        <feComposite in2="rim" operator="in"/>
      </filter>
    </defs>
    <path d={`${top}
      L103 3L171 1L223 3L278 2L331 3L377 1L376 157L320 159L252 157L194 160L130 158L75 159L2 157Z`}
      fill={`url(#${id}-paper)`} stroke="#b19861" strokeWidth="1.2"/>
    <g transform="translate(216 37)">
      <path d={HOME_PLAYER_PREVIEW_CONTOUR} fill={`url(#${id}-preview)`}/>
      <path d={HOME_PLAYER_PREVIEW_CONTOUR} fill="#000" filter={`url(#${id}-inner)`}/>
    </g>
    <path d="M39 119L173 118Q186 119 186 130Q184 143 173 143L38 142Q23 141 25 130Q24 120 39 119Z"
      transform="translate(0 -5)" fill="#f3f9c8"/>
    <path d={`M${headerTab ? headerTab.right + 4 : 7} 7L100 6M286 7L371 6M7 154L149 155`}
      stroke="#fffbe6" strokeWidth="1.5" fill="none" opacity=".7"/>
  </svg>;
}

export function HomeScoreStar({style}: {style?: CSSProperties} = {}) {
  const id = useId();
  const face = 'M19 4.2C27.9 3.9 34 10.6 34.1 19.2C34.5 28.4 27.8 35 19.1 35.1C10.5 35.3 4 28.4 4 19.6C3.6 10.8 10.1 4.2 19 4.2Z';
  return <svg className="home-score-star" style={style} viewBox="0 0 38 39" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2=".7" y2="1">
        <stop stopColor="#9e5351"/><stop offset=".35" stopColor="#b77f83"/>
        <stop offset=".7" stopColor="#dfc8ca"/><stop offset="1" stopColor="#f7f0e2"/>
      </linearGradient>
      <linearGradient id={`${id}-bevel`} x1="0" y1="0" x2=".5" y2="1">
        <stop stopColor="#c6a7ad"/><stop offset=".4" stopColor="#f3e9ec"/>
        <stop offset="1" stopColor="#fff"/>
      </linearGradient>
      <clipPath id={`${id}-face`}>
        <path d={face}/>
      </clipPath>
      <filter id={`${id}-inner`} x="-20%" y="-20%" width="140%" height="140%"
        colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="soft"/>
        <feOffset in="soft" dx=".8" dy="1.5" result="lower"/>
        <feComposite in="SourceAlpha" in2="lower" operator="out" result="rim"/>
        <feFlood floodColor="#855255" floodOpacity=".65"/>
        <feComposite in2="rim" operator="in"/>
      </filter>
    </defs>
    <path d="M19 1.3C29 .9 36.7 9.1 36.7 19.1C37.2 29.4 29.1 37.6 19.1 37.7C8.7 38.1 1.2 29.3 1.3 19.5C.9 9.4 8.7 1.3 19 1.3Z"
      fill={`url(#${id}-rim)`} stroke="#f6f8cf" strokeWidth="1.7"/>
    <g clipPath={`url(#${id}-face)`}>
      <path d={face} fill={`url(#${id}-bevel)`}/>
      <path d="M19.1 7.6C26.4 7.3 31.7 12.2 31.8 19.5C32.1 27.1 26.7 32.3 19.1 32.7C11.7 32.9 6.7 27 6.6 19.7C6.3 12.7 11.5 7.6 19.1 7.6Z"
        fill="#fff"/>
      <path d="M18.6 7.1L22 13.7L31.8 15.5L25.6 21.9L26.8 31.9L18.7 27.4L10.2 32.2L10.8 21.8L4.9 15.3L14.6 13.5Z"
        transform="translate(19 20) scale(.86) translate(-19 -20)"
        fill="#fff" stroke="#fff500" strokeWidth="2.5" strokeLinejoin="miter"/>
      <path d={face} fill="#000" filter={`url(#${id}-inner)`}/>
    </g>
  </svg>;
}

export function HomeShortcutPanel({valuableMode}: {valuableMode: boolean}) {
  if (valuableMode) return <GameCurrencyBoard className="home-shortcut-panel"
    data-home-shortcut-panel="" data-valuable-mode="" aria-hidden="true"/>;
  return <div className="home-shortcut-panel" data-home-shortcut-panel="" aria-hidden="true">
    <img src={imageResourceUrl('/ui/home/shortcut-board.png')} alt="" draggable={false}/>
    <span className="home-shortcut-heading">快捷键</span>
    {[0, 1, 2, 3].map(index => <span key={index} className="home-shortcut-slot-frame" style={{left: 14 + index * 44}}/>)}
    <span className="home-currency-strip" data-currency="money"/>
    <span className="home-currency-strip" data-currency="tokens"/>
  </div>;
}
