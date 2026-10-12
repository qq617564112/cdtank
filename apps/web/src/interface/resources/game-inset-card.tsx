import type {ComponentPropsWithoutRef} from 'react';
import {CARD_SHAPES, GameCardArtwork, type GameCardTone} from './game-card-artwork';
import {GameSelectionHighlight} from './game-selection-highlight';

export interface GameInsetCardProps extends ComponentPropsWithoutRef<'div'> {
  shape: 'options' | 'modes' | 'keyboard' | 'selection';
  tone?: GameCardTone;
  insetShadow?: boolean;
}

/** Tertiary cards use the MDF texture, while selection retains the original hand-drawn brush. */
export function GameInsetCard({shape, tone = 'coral', insetShadow = false, className = '', style, children, ...props}: GameInsetCardProps) {
  const size = CARD_SHAPES[shape];
  const innerShadow = insetShadow ? {
    width: typeof style?.width === 'number' ? style.width : size.width,
    height: typeof style?.height === 'number' ? style.height : size.height,
  } : undefined;
  return <div {...props} className={`game-inset-card ${className}`} data-card-shape={shape} data-card-tone={tone}
    style={{...CARD_SHAPES[shape], ...style}}>
    {shape === 'selection'
      ? <GameSelectionHighlight/>
      : <GameCardArtwork shape={shape} tone={tone} innerShadow={innerShadow}/>}
    {children}
  </div>;
}
