import {useId} from 'react';
import './game-confirm-frame.css';

/** Two translucent panels share the confirmation dialog's cyan bevel. */
export function GameConfirmFrame({width, height, headerHeight}: {width: number; height: number; headerHeight: number}) {
  const id = useId();
  return <svg className="game-confirm-frame" viewBox={`0 0 ${width} ${height}`}
    aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#dbffff"/>
        <stop offset=".2" stopColor="#74c6dc"/>
        <stop offset=".7" stopColor="#4594b0"/>
        <stop offset="1" stopColor="#bbf2ee"/>
      </linearGradient>
      <linearGradient id={`${id}-header`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#34263f" stopOpacity=".9"/>
        <stop offset="1" stopColor="#201b38" stopOpacity=".86"/>
      </linearGradient>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#315477" stopOpacity=".88"/>
        <stop offset="1" stopColor="#23466e" stopOpacity=".84"/>
      </linearGradient>
    </defs>
    {([{top: 0, height: headerHeight, fill: 'header'},
      {top: headerHeight, height: height - headerHeight, fill: 'body'}]).map(panel => <g key={panel.fill}>
      <rect x="1" y={panel.top + 1} width={width - 2} height={panel.height - 2} rx="8"
        fill={`url(#${id}-${panel.fill})`} stroke="#254b63" strokeWidth="2"/>
      <rect x="1" y={panel.top + 1} width={width - 2} height={panel.height - 2} rx="8"
        fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.6"/>
      <rect x="3" y={panel.top + 3} width={width - 6} height={panel.height - 6} rx="6"
        fill="none" stroke="#a6ebf5" strokeWidth=".7" opacity=".55"/>
      <path d={`M10 ${panel.top + 2}H${width - 10}M2 ${panel.top + 11}V${panel.top + panel.height - 11}`}
        fill="none" stroke="#efffff" strokeWidth=".6" opacity=".7"/>
    </g>)}
  </svg>;
}
