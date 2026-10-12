import {imageResourceUrl} from '../../assets/image-cache';
import {useId} from 'react';
import {GameSurfaceTexture, type GameSurfaceTone} from './game-surface-texture';
import './game-card.css';

export type GameCardTone = GameSurfaceTone;

export const CARD_SHAPES = {
  strip: {width: 676, height: 50},
  panel: {width: 326, height: 414},
  chat: {width: 373, height: 343},
  display: {width: 354, height: 115},
  options: {width: 129, height: 92},
  modes: {width: 201, height: 92},
  keyboard: {width: 291, height: 190},
  selection: {width: 492, height: 32},
} as const;

interface CardArtworkProps {
  shape: keyof typeof CARD_SHAPES;
  tone: GameCardTone;
  framed?: boolean;
  frameSize?: {width: number; height: number;};
  innerShadow?: {width: number; height: number;};
}

/** A single contour clips the photographed fibers and carries the frame stroke. */
export function GameCardArtwork({shape, tone, framed = false, frameSize, innerShadow}: CardArtworkProps) {
  const id = useId();
  const textureId = `${id}-texture`;
  const shadeId = `${id}-shade`;
  const highlightId = `${id}-highlight`;
  const innerShadowId = `${id}-inner-shadow`;
  const {width, height} = CARD_SHAPES[shape];
  const frameScale = frameSize ? {x: width / frameSize.width, y: height / frameSize.height} : {x: 1, y: 1};
  const shadowScale = innerShadow ? {x: width / innerShadow.width, y: height / innerShadow.height} : undefined;
  const outline = `/ui/cards/outlines.svg#${shape}`;
  return <svg className={`game-card-artwork${framed ? ' game-card-artwork-framed' : ''}`}
    viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <GameSurfaceTexture id={textureId} tone={tone}/>
    <defs>
      <linearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff4d7" stopOpacity=".07"/>
        <stop offset=".45" stopColor="#fff4d7" stopOpacity="0"/>
        <stop offset="1" stopColor="#782c19" stopOpacity=".035"/>
      </linearGradient>
      {framed && <filter id={highlightId} x="-10%" y="-20%" width="120%" height="140%"
        colorInterpolationFilters="sRGB">
        <feOffset in="SourceAlpha" dx={.5 * frameScale.x} dy={1.15 * frameScale.y} result="inset-contour"/>
        <feComposite in="SourceAlpha" in2="inset-contour" operator="out" result="lit-edge"/>
        <feGaussianBlur in="lit-edge" stdDeviation={`${.85 * frameScale.x} ${.85 * frameScale.y}`}
          result="soft-light"/>
        <feComposite in="soft-light" in2="SourceAlpha" operator="in" result="clipped-light"/>
        <feFlood floodColor="#fff2d1" floodOpacity=".48" result="light-color"/>
        <feComposite in="light-color" in2="clipped-light" operator="in"/>
      </filter>}
      {shadowScale && <filter id={innerShadowId} x="-10%" y="-20%" width="120%" height="140%"
        colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation={`${1.35 * shadowScale.x} ${1.35 * shadowScale.y}`}
          result="soft-contour"/>
        <feOffset in="soft-contour" dx={.75 * shadowScale.x} dy={1.2 * shadowScale.y} result="lower-contour"/>
        <feComposite in="SourceAlpha" in2="lower-contour" operator="out" result="inner-edge"/>
        <feFlood floodColor="#2f170e" floodOpacity=".78" result="shadow-color"/>
        <feComposite in="shadow-color" in2="inner-edge" operator="in"/>
      </filter>}
    </defs>
    <use href={imageResourceUrl(outline)} fill={`url(#${textureId})`}
      stroke={framed ? '#665047' : 'none'} strokeOpacity=".75" strokeWidth=".9" strokeLinejoin="round"/>
    {innerShadow && <use href={imageResourceUrl(outline)} fill="#000" filter={`url(#${innerShadowId})`}/>}
    {framed && <>
      <use href={imageResourceUrl(outline)} fill={`url(#${shadeId})`}/>
      <use href={imageResourceUrl(outline)} fill="#fff" filter={`url(#${highlightId})`}/>
    </>}
  </svg>;
}
