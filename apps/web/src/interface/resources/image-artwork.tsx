import type {ComponentPropsWithoutRef} from 'react';
import {imageResourceUrl} from '../../assets/image-cache';
import {spriteAtlas, spriteRegion} from '../../assets/sprite-images';

/** Original images stretch, fit or repeat within their source control bounds. */
export function ImageArtwork({asset, fit = 'stretch', repeat, style, ...props}: {
  asset: string; fit?: 'stretch' | 'contain'; repeat?: {width: number; height: number};
} & ComponentPropsWithoutRef<'span'>) {
  const region = spriteRegion(asset);
  const atlas = region ? spriteAtlas(region.atlas) : undefined;
  const href = imageResourceUrl(region && !repeat ? region.atlas : asset);
  return <span {...props} data-image-artwork="" data-source-asset={asset.replace(/^\//, '')}
    data-image-fit={fit} data-image-repeat-width={repeat?.width} data-image-repeat-height={repeat?.height}
    style={{display: 'inline-block', ...style}}>
    {repeat ? <span aria-hidden="true" style={{display: 'block', width: '100%', height: '100%',
      pointerEvents: 'none', backgroundImage: `url("${href}")`,
      backgroundSize: `${repeat.width}px ${repeat.height}px`, backgroundRepeat: 'repeat'}}/> :
    region && atlas ? <svg viewBox={`0 0 ${region.width} ${region.height}`}
      preserveAspectRatio={fit === 'contain' ? 'xMidYMid meet' : 'none'} aria-hidden="true" focusable="false"
      style={{display: 'block', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none'}}>
      <svg viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`}
        width={region.width} height={region.height} preserveAspectRatio="none" overflow="hidden">
        <image href={href} width={atlas.width} height={atlas.height}/>
      </svg>
    </svg> : <img src={href} alt="" aria-hidden="true" draggable={false}
      style={{display: 'block', width: '100%', height: '100%', pointerEvents: 'none',
        objectFit: fit === 'contain' ? 'contain' : 'fill'}}/>}
  </span>;
}

/** SVG consumers retain their placement while reading directly from the shared atlas. */
export function SvgImageArtwork({asset, x, y, width, height,
  preserveAspectRatio = 'xMidYMid meet'}: {
  asset: string; x?: number; y?: number; width: number; height: number; preserveAspectRatio?: string;
}) {
  const region = spriteRegion(asset);
  const atlas = region ? spriteAtlas(region.atlas) : undefined;
  if (region && atlas) return <svg x={x} y={y} width={width} height={height}
    viewBox={`0 0 ${region.width} ${region.height}`}
    preserveAspectRatio={preserveAspectRatio} overflow="hidden">
    <svg viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`}
      width={region.width} height={region.height} preserveAspectRatio="none" overflow="hidden">
      <image href={imageResourceUrl(region.atlas)} width={atlas.width} height={atlas.height}/>
    </svg>
  </svg>;
  return <image href={imageResourceUrl(asset)} x={x} y={y} width={width} height={height}
    preserveAspectRatio={preserveAspectRatio}/>;
}
