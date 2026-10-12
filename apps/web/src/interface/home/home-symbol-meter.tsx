import {useId} from 'react';
import {imageResourceUrl} from '../../assets/image-cache';

/** Mastery stars and battle cartridges share the source progress clipping. */
export function HomeSymbolMeter({kind, width, height, extent}: {
  kind: 'stars' | 'shells'; width: number; height: number; extent: number;
}) {
  const id = useId();
  const stars = kind === 'stars';
  return <svg className="home-symbol-meter" viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={`${id}-progress`}>
        <rect width={extent} height={height}/>
      </clipPath>
    </defs>
    <g clipPath={`url(#${id}-progress)`}>
      {stars ? Array.from({length: 5}, (_, index) => <path key={index}
        transform={`translate(${index * 12} 0)`}
        d="M5.8 1.3L7.3 4.2L10.5 4.6L8.2 6.9L8.8 10.1L5.8 8.6L2.9 10.2L3.4 6.9L1.1 4.6L4.4 4.2Z"
        fill="#fff000" stroke="#cf9c00" strokeWidth=".65" strokeLinejoin="round"/>)
        : Array.from({length: 6}, (_, index) => <svg key={index} x={2 + index * 15}
          width={height * 15 / 35} height={height} viewBox="0 0 15 35" overflow="hidden">
          <image href={imageResourceUrl('/ui/regions/77/17.png')} width="180" height="35"
            style={{imageRendering: 'pixelated'}}/>
        </svg>)}
    </g>
  </svg>;
}
