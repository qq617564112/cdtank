import type {ComponentPropsWithoutRef} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from './source-ui-layout';
import {sourceProps} from './source-ui-props';

export type SourceStaticTextProps = {
  ui: HomeSourceUi; layout: HomeSourceLayout; name: string; text: string; suffix: string;
} & ComponentPropsWithoutRef<'span'>;

/** Dynamic text retains source bounds and alignment with the user-selected font. */
export function SourceStaticText({ui, layout, name, text, suffix, className = '', ...attributes}: SourceStaticTextProps) {
  const props = sourceProps(ui, layout, suffix, name);
  const properties = layout.control(name).properties;
  const horizontal = properties.HorzFormatting ?? 'LeftAligned';
  const vertical = properties.VertFormatting ?? 'VertCentred';
  return <span {...props} {...attributes} className={`source-static-text ${className}`}
    data-source-font="xiangjiao-brush" data-source-font-viewport="800,600" data-source-text-colour="FFFFFFFF"
    data-source-horz-format={horizontal} data-source-vert-format={vertical} data-source-text-clip="text-area-intersect-window"
    style={{...props.style, display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 12,
      lineHeight: '15px', color: '#fff',
      justifyContent: horizontal === 'HorzCentred' ? 'center' : horizontal === 'RightAligned' ? 'flex-end' : 'flex-start',
      alignItems: vertical === 'TopAligned' ? 'flex-start' : vertical === 'BottomAligned' ? 'flex-end' : 'center'}}>
    <span data-source-text-content="" style={{textShadow: 'none'}}>{text}</span>
  </span>;
}
