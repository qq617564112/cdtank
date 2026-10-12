import {useId} from 'react';
import {GameSurfaceTexture} from '../resources/game-surface-texture';
import './shop-hd.css';

/** Maintenance cards keep their source corner radii at the full button dimensions. */
export function ShopMaintenanceArtwork({width, height, verticalInset = 11}: {
  width: number; height: number; verticalInset?: number;
}) {
  const id = useId();
  const top = verticalInset, bottom = height - verticalInset;
  const outline = `M16 ${top}L${width - 16} ${top}Q${width - 10} ${top} ${width - 10} ${top + 6}
    L${width - 10.5} ${bottom - 6}Q${width - 11} ${bottom} ${width - 17} ${bottom}
    L16 ${bottom + .5}Q10 ${bottom + .5} 10 ${bottom - 6}L10.5 ${top + 6}Q10.5 ${top} 16 ${top}Z`;
  return <svg className="shop-maintenance-artwork" viewBox={`0 0 ${width} ${height}`}
    aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="var(--cartoon-button-face-top)"/>
        <stop offset=".55" stopColor="var(--cartoon-button-face)"/>
        <stop offset="1" stopColor="var(--cartoon-button-face)"/>
      </linearGradient>
    </defs>
    <path className="shop-maintenance-shadow" d={outline} fill="#203f36" opacity=".85" transform="translate(1 4)"/>
    <path d={outline} fill={`url(#${id}-face)`} stroke="var(--cartoon-button-rim)" strokeWidth="2"/>
    <path d={`M12 ${top + 7}Q12 ${top + 2} 17 ${top + 2}H${width - 17}Q${width - 13} ${top + 2} ${width - 12.5} ${top + 6}
      M12.5 ${top + 6}V${bottom - 7}`} fill="none" stroke="var(--cartoon-button-highlight)" strokeWidth="2.5" strokeLinecap="round"/>
    <path d={`M14 ${bottom - 3}Q${width * .5} ${bottom - 1} ${width - 14} ${bottom - 3}
      M${width - 12.5} ${top + 7}V${bottom - 7}`} fill="none" stroke="var(--cartoon-button-bevel)" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

/** The source checked tab has a cloth stem that joins the panel below it. */
export function ShopTabArtwork({width, height}: {width: number; height: number}) {
  const id = useId();
  const edge = `${id}-edge`, face = `${id}-face`, shade = `${id}-shade`;
  const base = height - 11;
  const outer = `M1.3 1.4L9 1.1L10.1 4L12.5 1.7L${width * .36} 1.2
    L${width * .38} 3.6L${width * .42} 1.6L${width - 13} 1.2L${width - 11} 3.8
    L${width - 8.5} 1.2L${width - 1.5} 1.6L${width - 1.6} 9
    L${width - 4} 10.5L${width - 1.7} 12L${width - 1.5} 22
    L${width - 3.8} 24L${width - 1.6} 25.8L${width - 1.7} ${base}
    H1.4L1.6 29.5L4 27.8L1.4 26
    L1.6 17L3.8 15.5L1.5 13.8Z`;
  const interior = `M12 11.5L${width - 12} 11.5V${height}H12Z`;
  return <svg className="shop-tab-artwork" viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <GameSurfaceTexture id={edge} tone="room-edge" size={{width, height}}/>
    <GameSurfaceTexture id={face} tone="room-canvas" size={{width, height}}/>
    <defs>
      <filter id={shade} x="-10%" y="-20%" width="120%" height="140%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.15" result="soft"/>
        <feOffset in="soft" dx=".45" dy="1" result="lower"/>
        <feComposite in="SourceAlpha" in2="lower" operator="out" result="edge"/>
        <feFlood floodColor="#3e371d" floodOpacity=".25"/>
        <feComposite in2="edge" operator="in"/>
      </filter>
    </defs>
    <path d={outer} fill={`url(#${edge})`} stroke="#42501d" strokeWidth=".9" strokeLinejoin="round"/>
    <path d={`M7.5 7.5H${width - 7.5}V${base}H${width - 12}V11.5H12V${base}H7.5Z`} fill="#947d52"/>
    <path d={interior} fill={`url(#${face})`}/>
    <path d={interior} fill="#000" filter={`url(#${shade})`}/>
  </svg>;
}
