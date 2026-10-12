import {useId, type ComponentPropsWithoutRef} from 'react';
import {useButtonInteraction} from '../resources/button-interaction';
import './room-adjustment.css';

interface RoomAdjustmentButtonProps extends ComponentPropsWithoutRef<'button'> {
  direction: -1 | 1;
}

/** Player bounds and match duration use the same orange hand-drawn arrow. */
export function RoomAdjustmentButton({direction, className = '', ...props}: RoomAdjustmentButtonProps) {
  const id = useId();
  const {element, buttonProps, state} = useButtonInteraction(props);
  return <button {...buttonProps} ref={element} className={`room-adjustment-button ${className}`}
    data-source-button-state={state}>
    <svg viewBox="0 0 26 27" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--room-arrow-light)"/>
          <stop offset=".45" stopColor="var(--room-arrow-face)"/>
          <stop offset="1" stopColor="var(--room-arrow-shade)"/>
        </linearGradient>
      </defs>
      <g transform={direction > 0 ? 'translate(26 0) scale(-1 1)' : undefined}>
        <path d="M23.6 2.5 Q24.8 2.2 24.5 5.5 L24.1 24.1 Q24 26.5 22 25.3
          L2.6 15.4 Q.2 14.2 2.8 12.5 Z" fill="#26313d" opacity=".55"/>
        <path d="M22.9 1.5 Q24.1 .6 23.8 3.8 L23.4 23.7 Q23.4 25.4 21.8 24.4
          L2 14.6 Q.2 13.6 2.1 12.3 Z" fill="#453b3a" stroke="#151d2c" strokeWidth="1.5"
          strokeLinejoin="round"/>
        <path d="M21.6 3.6 L21.3 22.1 L4.6 13.5 Z" fill={`url(#${id})`}/>
        <path d="M5 13.4 L21.6 3.6 L20.5 7 L8 14.4 Z" fill="#ffe4c2" opacity=".8"/>
        <path d="M19.2 5.8 L18.7 20.7 L21.3 22.1 L21.6 3.6 Z" fill="#9b421e" opacity=".65"/>
      </g>
    </svg>
  </button>;
}
