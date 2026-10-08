import {useId, type ComponentPropsWithoutRef} from 'react';
import {imageResourceUrl, spriteImage} from '../../assets/image-cache';
import {imageRegion} from '../../assets/image-resources';

/** A clipped SVG viewport displays a sheet region without creating another image. */
export function ImageArtwork({asset, fit = 'stretch', repeat, style, ...props}: {
  asset: string; fit?: 'stretch' | 'contain'; repeat?: {width: number; height: number};
} & ComponentPropsWithoutRef<'span'>) {
  const id = `image-tile-${useId().replace(/:/g, '')}`;
  const region = imageRegion(asset)!;
  const image = region.image;
  const href = imageResourceUrl(spriteImage(asset)?.atlas ?? asset);
  return <span {...props} data-image-artwork="" data-source-asset={asset.replace(/^\//, '')}
    data-image-fit={fit} data-image-repeat-width={repeat?.width} data-image-repeat-height={repeat?.height}
    style={{display: 'inline-block', ...style}}>
    {repeat ? <svg width="100%" height="100%" aria-hidden="true" style={{display: 'block', pointerEvents: 'none'}}>
      <defs><pattern id={id} patternUnits="userSpaceOnUse" width={repeat.width} height={repeat.height}
        viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`} preserveAspectRatio="none">
        <image href={href} width={image.width} height={image.height}/>
      </pattern></defs>
      <rect width="100%" height="100%" fill={`url(#${id})`}/>
    </svg> :
    <svg width="100%" height="100%" viewBox={`0 0 ${region.width} ${region.height}`}
      preserveAspectRatio={fit === 'contain' ? 'xMidYMid meet' : 'none'}
      aria-hidden="true" style={{display: 'block', overflow: 'hidden', pointerEvents: 'none'}}>
      <svg width={region.width} height={region.height}
        viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`} preserveAspectRatio="none"
        style={{overflow: 'hidden'}}>
        <image href={href} width={image.width} height={image.height}/>
      </svg>
    </svg>}
  </span>;
}
