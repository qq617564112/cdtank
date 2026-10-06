import './source-static-image.css';
import {createContext, useContext, type CSSProperties, type ComponentPropsWithoutRef} from 'react';
import type {HomeSourceUi, HomeSourceLayout} from './source-ui-layout';
import {sourceProps} from './source-ui-props';

export const SourceImageScale = createContext(1);

function region(ui: HomeSourceUi, reference?: string) {
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  // Exported images retain the original atlas region dimensions.
  const image = set?.images.find(image => image.Name === match?.[2]);
  return image ? {...image, imageset: set!.attributes} : undefined;
}

/** Source static imagery, with enabled frame pieces kept at their atlas dimensions. */
export function SourceStaticImage({ui, layout, name, reference, suffix, offsetX = 0, offsetY = 0, className = '', children, ...attributes}: {
  ui: HomeSourceUi; layout: HomeSourceLayout; name: string; reference?: string; suffix: string; offsetX?: number; offsetY?: number;
} & ComponentPropsWithoutRef<'span'>) {
  const scale = useContext(SourceImageScale);
  const properties = layout.control(name).properties;
  const props = sourceProps(ui, layout, suffix, name, reference ?? properties.Image, offsetX, offsetY);
  const frame = properties.FrameEnabled !== 'False';
  const pieces = ['Top', 'Bottom', 'Left', 'Right', 'TopLeft', 'TopRight', 'BottomLeft', 'BottomRight']
    .map(position => ({position, image: frame ? region(ui, properties[`${position}FrameImage`]) : undefined}));
  const dimension = (image: NonNullable<ReturnType<typeof region>>, key: 'Width' | 'Height') => {
    const native = Number(image.imageset[key === 'Width' ? 'NativeHorzRes' : 'NativeVertRes'] ?? (key === 'Width' ? 800 : 600));
    const factor = image.imageset.AutoScaled === 'true' ? (key === 'Width' ? 800 : 600) * scale / native : 1;
    return Math.round(Math.fround(Number(image[key]) * Math.fround(factor))) / scale;
  };
  const size = (position: string, key: 'Width' | 'Height') => {
    const image = pieces.find(piece => piece.position === position)?.image;
    return image ? dimension(image, key) : 0;
  };
  const left = size('Left', 'Width');
  const right = size('Right', 'Width');
  const top = size('Top', 'Height');
  const bottom = size('Bottom', 'Height');
  return <span {...props} {...attributes} className={`source-static-image ${className}`}
    style={{...props.style, backgroundImage: undefined}}>
    {props['data-source-asset'] && <i data-source-image="" data-source-horz-format="HorzStretched" data-source-vert-format="VertStretched"
      data-source-offset="0,0" data-source-clip="inner-rectangle" data-source-asset={props['data-source-asset']}
      style={{inset: `${top}px ${right}px ${bottom}px ${left}px`, backgroundImage: props.style.backgroundImage}} />}
    {pieces.filter(piece => piece.image?.asset).map(({position, image}) => {
      const style: CSSProperties = {backgroundImage: `url('/${image!.asset}')`};
      if (position.includes('Left')) {style.left = 0; style.width = dimension(image!, 'Width');}
      else if (position.includes('Right')) {style.right = 0; style.width = dimension(image!, 'Width');}
      else {
        const edge = position === 'Top' ? 'Top' : 'Bottom';
        style.left = size(`${edge}Left`, 'Width'); style.right = size(`${edge}Right`, 'Width');
      }
      if (position.includes('Top')) {style.top = 0; style.height = dimension(image!, 'Height');}
      else if (position.includes('Bottom')) {style.bottom = 0; style.height = dimension(image!, 'Height');}
      else {style.top = size(`Top${position}`, 'Height'); style.bottom = size(`Bottom${position}`, 'Height');}
      return <i key={position} data-source-frame={`${position}FrameImage`} data-source-asset={image!.asset} style={style}/>;
    })}
    {children}
  </span>;
}

