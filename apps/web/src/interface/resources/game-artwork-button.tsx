import {imageResourceUrl} from '../../assets/image-cache';
import type {ComponentPropsWithoutRef} from 'react';
import {useButtonInteraction} from './button-interaction';
import './game-artwork-button.css';

export type GameArtworkButtonKind = 'tutorial' | 'settings' | 'return' | 'plaque';

/** Painted signs share state handling while their labels remain HTML. */
export function GameArtworkButton({kind, className = '', children, ...props}:
  ComponentPropsWithoutRef<'button'> & {kind: GameArtworkButtonKind}) {
  const {element, buttonProps, state} = useButtonInteraction(props);
  return <button {...buttonProps} ref={element} className={`game-artwork-button ${className}`}
    data-artwork-button={kind} data-source-button-state={state}>
    {kind === 'plaque' ? <img className="game-artwork-button-image" src={imageResourceUrl('/ui/lobby/hall-plaque.png')}
      alt="" aria-hidden="true" draggable={false}/> : (['Normal', 'Hover', 'Pushed'] as const).map(view => <img key={view}
      className="game-artwork-button-image" hidden={view !== (state === 'Disabled' ? 'Normal' : state)}
      src={imageResourceUrl(`/ui/lobby/${kind}-${view.toLowerCase()}.png`)} alt="" aria-hidden="true" draggable={false}/>)}
    {children && <span className="game-artwork-button-label">{children}</span>}
  </button>;
}
