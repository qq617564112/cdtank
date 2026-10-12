import type {ComponentPropsWithoutRef} from 'react';
import {CARD_SHAPES, GameCardArtwork, type GameCardTone} from './game-card-artwork';

export interface GameCardProps extends ComponentPropsWithoutRef<'div'> {
  shape: 'strip' | 'panel' | 'display' | 'chat';
  tone?: GameCardTone;
}

const DEFAULT_TONES = {strip: 'rose', panel: 'rose', display: 'peach', chat: 'sand'} as const;

/** Secondary panels accept normal HTML content above their textured SVG frame. */
export function GameCard({shape, tone = DEFAULT_TONES[shape], className = '', style, children, ...props}: GameCardProps) {
  const size = CARD_SHAPES[shape];
  const frameSize = {
    width: typeof style?.width === 'number' ? style.width : size.width,
    height: typeof style?.height === 'number' ? style.height : size.height,
  };
  return <div {...props} className={`game-card ${className}`} data-card-shape={shape} data-card-tone={tone}
    style={{...CARD_SHAPES[shape], ...style}}>
    <GameCardArtwork shape={shape} tone={tone} framed frameSize={frameSize}/>
    {children}
  </div>;
}
