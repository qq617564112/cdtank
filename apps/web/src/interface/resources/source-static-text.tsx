import type {ComponentPropsWithoutRef} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from './source-ui-layout';
import {sourceProps} from './source-ui-props';
import {SourceBitmapText} from './source-bitmap-font';

export type SourceStaticTextProps = {
  ui: HomeSourceUi; layout: HomeSourceLayout; name: string; text: string; suffix: string;
} & ComponentPropsWithoutRef<'span'>;

/** Dynamic text retains source bounds and alignment with the original font. */
export function SourceStaticText({ui, layout, name, text, suffix, className = '', ...attributes}: SourceStaticTextProps) {
  const props = sourceProps(ui, layout, suffix, name);
  const properties = layout.control(name).properties;
  const horizontal = properties.HorzFormatting ?? 'LeftAligned';
  const vertical = properties.VertFormatting ?? 'VertCentred';
  return <span {...props} {...attributes} className={`source-static-text ${className}`}
    data-source-font={properties.Font ?? 'SIMSUN'} data-source-font-viewport="800,600" data-source-text-colour="FFFFFFFF"
    data-source-horz-format={horizontal} data-source-vert-format={vertical} data-source-text-clip="text-area-intersect-window"
    style={{...props.style, display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 12,
      lineHeight: '15px', color: '#fff',
      justifyContent: horizontal === 'HorzCentred' ? 'center' : horizontal === 'RightAligned' ? 'flex-end' : 'flex-start',
      alignItems: vertical === 'TopAligned' ? 'flex-start' : vertical === 'BottomAligned' ? 'flex-end' : 'center'}}>
    <SourceBitmapText font={properties.Font} text={text}
      fallback={<span data-source-text-content="" style={{textShadow: 'none'}}>{text}</span>}/>
  </span>;
}
