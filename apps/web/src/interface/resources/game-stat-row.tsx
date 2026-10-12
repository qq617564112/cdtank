import type {ComponentPropsWithoutRef} from 'react';
import './game-stat-row.css';

/** Labels, values and units share a baseline within their source row bounds. */
export function GameStatRow({className = '', contentClassName = '', children, ...props}:
  ComponentPropsWithoutRef<'div'> & {contentClassName?: string}) {
  return <div {...props} className={`game-stat-row ${className}`}>
    <div className={`game-stat-content ${contentClassName}`}>{children}</div>
  </div>;
}
