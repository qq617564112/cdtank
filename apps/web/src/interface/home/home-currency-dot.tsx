import {useId} from 'react';

/** Shared currency marker, lit from the upper left like the source artwork. */
export function HomeCurrencyDot({tone}: {tone: 'gold' | 'blue' | 'pearl'}) {
  const id = useId();
  const palette = {
    gold: {light: '#fff8c3', top: '#ffe890', face: '#f1c159', shade: '#b27c25', rim: '#705621', glint: '#fff9d5'},
    blue: {light: '#ccefff', top: '#7ed5f7', face: '#65afe7', shade: '#367091', rim: '#626039', glint: '#dbf5ff'},
    pearl: {light: '#fffef0', top: '#e7f7ff', face: '#b4dbe7', shade: '#709eb0', rim: '#a18554', glint: '#fff'},
  }[tone];
  return <svg className="home-currency-dot" viewBox="0 0 13 13" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}-face`} cx="30%" cy="25%" r="78%">
        <stop stopColor={palette.light}/>
        <stop offset=".4" stopColor={palette.top}/>
        <stop offset=".72" stopColor={palette.face}/>
        <stop offset="1" stopColor={palette.shade}/>
      </radialGradient>
    </defs>
    <path d="M7 1.6C10 1.5 12 4 12 7C12.4 10 10.1 12 7.4 12C4.4 12.3 2 10 2 7C1.7 4.1 4 1.5 7 1.6Z"
      fill="#241b0b" opacity=".7"/>
    <path d="M6 1C9 0.8 11 3.1 11 6C11.5 9 9 11.2 6.4 11.1C3.4 11.3 1.1 9 1.1 6C.8 3.2 3.1 .8 6 1Z"
      fill={`url(#${id}-face)`} stroke={palette.rim} strokeWidth=".8"/>
    <path d="M2.8 3.7Q4.9 1.5 8.1 2.5L7.8 4.1Q5.1 3.5 3.1 5.3Z"
      fill={palette.glint} opacity=".85"/>
  </svg>;
}
