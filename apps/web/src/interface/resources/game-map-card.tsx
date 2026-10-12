import {imageResourceUrl} from '../../assets/image-cache';
import {useId, type ComponentPropsWithoutRef, type ReactNode} from 'react';
import {useButtonInteraction} from './button-interaction';
import {GameSurfaceTexture} from './game-surface-texture';
import './game-map-card.css';

interface GameMapCardProps extends ComponentPropsWithoutRef<'button'> {
  thumbnail: ReactNode;
  name: string;
}

/** Map previews share their source card's contour, material and HTML caption. */
export function GameMapCard({thumbnail, name, className = '', ...props}: GameMapCardProps) {
  const {element, buttonProps, state} = useButtonInteraction(props);
  const id = useId();
  const textureId = `${id}-texture`;
  const colorId = `${id}-color`;
  const artwork = '/ui/map-selector/card.svg';
  return <button {...buttonProps} ref={element} className={`game-map-card ${className}`}
    aria-label={props['aria-label'] ?? name} data-source-button-state={state}>
    <span className="game-map-card-content" aria-hidden="true">
      <svg className="game-map-card-art" viewBox="0 0 148 154" preserveAspectRatio="none" focusable="false">
        <GameSurfaceTexture id={textureId} tone="sand" size={{width: 148, height: 154}}/>
        <defs>
          <filter id={colorId} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 .89 0 0 .105 0 0 1 0 0 0 0 0 1 0"/>
          </filter>
        </defs>
        <use href={imageResourceUrl(`${artwork}#edge`)} fill="#273047" transform="translate(2 3.5)"/>
        <use href={imageResourceUrl(`${artwork}#edge`)} fill="#393729" stroke="#111b2c" strokeWidth="1.8" strokeLinejoin="round"/>
        <use href={imageResourceUrl(`${artwork}#face`)} fill={`url(#${textureId})`} filter={`url(#${colorId})`}/>
        <use href={imageResourceUrl(`${artwork}#highlight`)} fill="#fffbe3"/>
        <use href={imageResourceUrl(`${artwork}#bevel`)} fill="#d88c30"/>
      </svg>
      <span className="game-map-card-thumbnail">{thumbnail}</span>
      <span className="game-map-card-name" title={name}>{name}</span>
    </span>
  </button>;
}
