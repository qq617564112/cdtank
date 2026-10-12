import {useId, type ComponentPropsWithoutRef} from 'react';

/** Popup frames draw the cyan rim and translucent violet fill at their native dimensions. */
export function GameGlassFrame({width, height, style, ...props}:
  ComponentPropsWithoutRef<'svg'> & {width: number; height: number}) {
  const id = useId();
  const faceWidth = width - 3, faceHeight = height - 3;
  return <svg {...props} width={width} height={height} viewBox={`0 0 ${width} ${height}`}
    style={{overflow: 'visible', ...style}} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#00cbff"/>
        <stop offset=".08" stopColor="#5db0cd"/>
        <stop offset=".9" stopColor="#5db0cd"/>
        <stop offset="1" stopColor="#73acc8"/>
      </linearGradient>
      <linearGradient id={`${id}-highlight`} x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#fff"/>
        <stop offset=".08" stopColor="#8cffff"/>
        <stop offset=".9" stopColor="#8cffff"/>
        <stop offset="1" stopColor="#adffff"/>
      </linearGradient>
      <filter id={`${id}-soft-rim`} x="-2%" y="-5%" width="104%" height="110%"
        colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation=".25"/>
      </filter>
    </defs>
    <rect x="1.5" y="1.5" width={faceWidth} height={faceHeight} rx="6.5" fill="#0d004c" fillOpacity={187 / 255}/>
    <g fill="none" filter={`url(#${id}-soft-rim)`}>
      <rect x="1.5" y="1.5" width={faceWidth} height={faceHeight} rx="6.5" stroke={`url(#${id}-rim)`} strokeWidth="3"/>
      <rect x="1.5" y="1.5" width={faceWidth} height={faceHeight} rx="6.5" stroke={`url(#${id}-highlight)`} strokeWidth="1"/>
    </g>
  </svg>;
}
