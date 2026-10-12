import {useId, type ComponentPropsWithoutRef} from 'react';
import './game-currency-board.css';

/** A two-row wooden balance board drawn at its displayed proportions. */
export function GameCurrencyBoard({children, className = '', ...props}: ComponentPropsWithoutRef<'div'>) {
  const id = useId();
  const edge = 'M4 11L55 10L59 2L136 2L140 10L193 10L199 14L197 31L195 35L198 56L191 62L7 62L1 57L3 38L1 34L3 15Z';
  return <div {...props} className={`game-currency-board ${className}`}>
    <svg viewBox="0 0 200 63" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#bba563"/>
          <stop offset=".35" stopColor="#a98c43"/>
          <stop offset=".7" stopColor="#c1a45c"/>
          <stop offset="1" stopColor="#9d803c"/>
        </linearGradient>
        <linearGradient id={`${id}-recess`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#401c0c"/>
          <stop offset=".18" stopColor="#5a260f"/>
          <stop offset="1" stopColor="#4b200d"/>
        </linearGradient>
        <clipPath id={`${id}-edge`}><path d={edge}/></clipPath>
      </defs>
      <path d={edge} fill="#68532b" stroke="#302819" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M5 13L57 12L61 4L134 4L138 12L192 12L196 15L194 32L192 35L195 55L190 59L8 60L4 56L6 38L4 34Z"
        fill={`url(#${id}-wood)`}/>
      <g clipPath={`url(#${id}-edge)`} fill="none" strokeLinecap="round">
        <path d="M5 16Q39 13 66 15T126 15T196 15M6 37Q42 35 78 37T143 36T194 37M8 58Q44 53 82 57T151 57T194 55"
          stroke="#dfc682" strokeWidth="1.1" opacity=".75"/>
        <path d="M17 12L47 12M65 6Q84 8 112 6M148 12L174 12M7 33Q41 30 70 33M87 38Q110 36 141 38M8 55Q34 58 55 53M151 59L181 57"
          stroke="#80652e" strokeWidth=".8" opacity=".7"/>
        <path d="M10 17L38 16M66 9L115 8M160 17L189 16M12 39L47 39M111 39L154 38M68 59L113 59"
          stroke="#e8ce8a" strokeWidth=".5" opacity=".65"/>
      </g>
      <path d="M4 15L13 14L7 17ZM58 3L63 4L60 7ZM166 10L174 10L168 14ZM197 25L193 29L196 30ZM6 58L14 57L9 61Z"
        fill="#564725"/>
      {[19, 40].map(top => <g key={top}>
        <rect x="6" y={top} width="183" height="15" rx="2" fill={`url(#${id}-recess)`}/>
        <path d={`M8 ${top + 1}H187`} fill="none" stroke="#29170c" strokeWidth=".8"/>
        <path d={`M7 ${top + 14}H188`} fill="none" stroke="#e4c385" strokeWidth=".7"/>
      </g>)}
      <path d="M4 18L3 33M4 40L3 54M9 60L190 60L195 56" fill="none" stroke="#e4c580" strokeWidth=".8" opacity=".6"/>
    </svg>
    {children}
  </div>;
}
