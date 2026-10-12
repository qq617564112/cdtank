import {imageResourceUrl} from '../../assets/image-cache';
import {useId, type ComponentPropsWithoutRef} from 'react';
import {GameSurfaceTexture} from '../resources/game-surface-texture';

const CARD_SIZES = {
  metadata: {width: 282, height: 106},
  rules: {width: 282, height: 177},
  strip: {width: 272, height: 33},
} as const;

interface RoomCreateCardProps extends ComponentPropsWithoutRef<'div'> {
  shape: keyof typeof CARD_SIZES;
}

/** Source green cards and cream strips keep one continuous textured contour. */
export function RoomCreateCard({shape, className = '', children, ...props}: RoomCreateCardProps) {
  const id = useId();
  const textureId = `${id}-texture`;
  const greenId = `${id}-green`;
  const insetId = `${id}-inset`;
  const outline = `/ui/room-create/panels.svg#${shape}`;
  const size = CARD_SIZES[shape];
  const strip = shape === 'strip';
  return <div {...props} className={`room-create-card room-create-card-${shape} ${className}`}>
    <svg className="room-create-card-art" viewBox={`0 0 ${size.width} ${size.height}`}
      preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <GameSurfaceTexture id={textureId} tone={strip ? 'input-cream' : 'player-paper'} size={size}/>
      <defs>
        <filter id={greenId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values=".82 0 0 0 .06 0 1.10 0 0 .02 0 0 1.10 0 .045 0 0 0 1 0"/>
        </filter>
        <filter id={insetId} x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.7" result="soft-contour"/>
          <feOffset in="soft-contour" dx=".5" dy="1.4" result="lower-contour"/>
          <feComposite in="SourceAlpha" in2="lower-contour" operator="out" result="inner-edge"/>
          <feFlood floodColor="#655e32" floodOpacity=".5"/>
          <feComposite in2="inner-edge" operator="in"/>
        </filter>
      </defs>
      {!strip && <use href={imageResourceUrl(outline)} fill="#d8f5bf" stroke="#938351" strokeWidth="2.8" strokeLinejoin="round"/>}
      <use href={imageResourceUrl(outline)} fill={`url(#${textureId})`} filter={strip ? undefined : `url(#${greenId})`}/>
      {!strip && <use href={imageResourceUrl(outline)} fill="#000" filter={`url(#${insetId})`}/>}
    </svg>
    {children}
  </div>;
}
