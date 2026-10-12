import type {ComponentPropsWithoutRef} from 'react';
import {GameGlassFrame} from './game-glass-frame';
import './game-item-tooltip.css';

/** Shared item description frame with HTML content and a translucent SVG rim. */
export function GameItemTooltip({children, className = '', ...props}: ComponentPropsWithoutRef<'section'>) {
  return <section {...props} role="tooltip" className={`game-item-tooltip ${className}`}>
    <GameGlassFrame className="game-item-tooltip-frame" width={200} height={85}/>
    {children}
  </section>;
}
