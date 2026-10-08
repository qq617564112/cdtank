import {imageResourceBackground} from '../../assets/image-cache';
import './source-progress.css';
import {useId, type ComponentProps, type CSSProperties} from 'react';
import {lifeProgress} from '../battle/life-progress';

interface ProgressUi {
  imagesets: {
    path: string;
    attributes: {Name: string; AutoScaled?: string; NativeHorzRes?: string; NativeVertRes?: string};
    images: {Name: string; Width: string; Height: string; asset?: string}[];
  }[];
}

/** Original progress bars tile source images and clip to rounded display pixels. */
export function SourceProgress({control, data, fraction, scale, style, className, ...props}: {
  control: {properties: Record<string, string>}; data: ProgressUi;
  fraction: number; scale: number; style: CSSProperties;
} & ComponentProps<'div'>) {
  const id = useId(), filterId = `original-progress-colour-${id.replace(/:/g, '')}`;
  const properties = control.properties, vertical = properties.ProgressFormat === 'Vertical';
  const width = Number(style.width), height = Number(style.height);
  const projection = lifeProgress(fraction, 1, Math.fround((vertical ? height : width) * scale));
  const colour = properties[['ProgressLowBoundColour', 'ProgressMediumColour', 'ProgressHighBoundColour'][projection.band]] ?? 'FFFFFFFF';
  const rgb = [2, 4, 6].map(offset => parseInt(colour.slice(offset, offset + 2), 16) / 255);
  const clip = vertical ? `inset(${height - projection.extent / scale}px 0 0 0)`
    : `inset(0 ${width - projection.extent / scale}px 0 0)`;
  function tile(reference: string | undefined): CSSProperties {
    const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
    const sets = data.imagesets.filter(set => set.attributes.Name === match?.[1]);
    const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
    const region = set?.images.find(region => region.Name === match?.[2]);
    if (!region?.asset) return {};
    const dimension = (axis: 'Width' | 'Height') => {
      const native = Number(set.attributes[axis === 'Width' ? 'NativeHorzRes' : 'NativeVertRes'] ?? (axis === 'Width' ? 800 : 600));
      const factor = set.attributes.AutoScaled === 'true' ? (axis === 'Width' ? 800 : 600) * scale / native : 1;
      return Math.round(Math.fround(Number(region[axis]) * Math.fround(factor)));
    };
    const tileWidth = dimension('Width'), tileHeight = dimension('Height');
    const columns = Math.trunc((width * scale + tileWidth - 1) / tileWidth);
    const rows = Math.trunc((height * scale + tileHeight - 1) / tileHeight);
    return {width: columns * tileWidth / scale, height: rows * tileHeight / scale,
      backgroundImage: imageResourceBackground(`/${region.asset}`), backgroundSize: `${tileWidth / scale}px ${tileHeight / scale}px`, backgroundRepeat: 'repeat'};
  }
  return <div {...props} className={`source-control source-progress-control ${className ?? ''}`} style={{...style, backgroundImage: 'none'}}
    data-progress-format={vertical ? 'Vertical' : 'Horizontal'} data-source-progress-fraction={projection.fraction}
    data-source-progress-extent={projection.extent} data-source-progress-colour={colour}
    role="progressbar">
    <svg width="0" height="0"><filter id={filterId} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={`${rgb[0]} 0 0 0 0  0 ${rgb[1]} 0 0 0  0 0 ${rgb[2]} 0 0  0 0 0 1 0`} />
    </filter></svg>
    <div className="source-life-background source-progress-background" style={tile(properties.BackgroundImage)} />
    <div className="source-progress-fill" style={{clipPath: clip}}>
      <div className="source-life-image source-progress-image" style={{...tile(properties.ProgressImage), filter: `url(#${filterId})`}} />
    </div>
  </div>;
}
