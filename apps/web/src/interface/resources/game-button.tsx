import {imageResourceUrl} from '../../assets/image-cache';
import type {ComponentPropsWithoutRef, CSSProperties} from 'react';
import {CartoonButtonArtwork, type CartoonButtonShape} from './cartoon-button-artwork';
import {CartoonButton, type CartoonButtonTone} from './cartoon-controls';
import {useButtonInteraction} from './button-interaction';
import './game-button.css';

export type GameButtonShape = CartoonButtonShape;
export type GameButtonTone = CartoonButtonTone;

export interface GameButtonProps extends ComponentPropsWithoutRef<'button'> {
  shape?: GameButtonShape;
  tone?: GameButtonTone;
  gradient?: boolean;
}

/** Lobby controls use the same painted frame and interaction as login controls. */
export function GameButton({shape = 'bevel', tone = 'blue', className = '', style, ...props}: GameButtonProps) {
  const width = typeof style?.width === 'number' ? style.width : shape === 'previous' || shape === 'next' ? 26 : 91;
  const height = typeof style?.height === 'number' ? style.height : 41;
  return <CartoonButton {...props} width={width} height={height} shape={shape} tone={tone} style={style}
    className={`game-button ${className}`}/>;
}

/** The selected gear is shared by both social tabs; labels stay native HTML. */
export function GameTabButton({selected, className = '', style, children, ...props}:
  ComponentPropsWithoutRef<'button'> & {selected: boolean}) {
  const {element, buttonProps, state} = useButtonInteraction(props);
  const width = typeof style?.width === 'number' ? style.width : 64;
  const height = typeof style?.height === 'number' ? style.height : 33;
  return <button {...buttonProps} ref={element} className={`cartoon-button game-button game-tab-button ${className}`}
    data-cartoon-button-state={state === 'Disabled' ? 'disabled' : state === 'Hover' ? 'hover' : state === 'Pushed' ? 'pressed' : 'normal'}
    data-cartoon-button-tone="cyan" data-cartoon-button-shape="tab"
    data-source-button-state={state} aria-pressed={selected}
    style={{width, height, '--cartoon-button-pressed-scale': (width - 8) / width, ...style} as CSSProperties}>
    {selected ? <img className="game-tab-selected-art" src={imageResourceUrl('/ui/lobby/tab-selected.png')} alt=""
      aria-hidden="true" draggable={false}/> : <CartoonButtonArtwork width={width} shape="tab"/>}
    <span className="cartoon-control-label">{children}</span>
  </button>;
}
