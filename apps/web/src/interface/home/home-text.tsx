import type {SourceStaticTextProps} from '../resources/source-static-text';
import {sourceProps} from '../resources/source-ui-props';
import './home-artwork.css';

/** Player information uses native font glyphs inside the original control bounds. */
export function HomeStaticText({ui, layout, name, suffix, text, className = '', style, ...props}: SourceStaticTextProps) {
  const bounds = sourceProps(ui, layout, suffix, name);
  const properties = layout.control(name).properties;
  return <span {...bounds} {...props} className={`source-static-text home-font-text ${className}`}
    style={{...bounds.style,
      justifyContent: properties.HorzFormatting === 'RightAligned' ? 'flex-end' : properties.HorzFormatting === 'HorzCentred' ? 'center' : 'flex-start',
      alignItems: properties.VertFormatting === 'TopAligned' ? 'flex-start' : properties.VertFormatting === 'BottomAligned' ? 'flex-end' : 'center',
      ...style}}><span data-source-text-content="">{text}</span></span>;
}
