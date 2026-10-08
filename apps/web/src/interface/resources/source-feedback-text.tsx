import './app-font.css';
import type {SourceStaticTextProps} from './source-static-text';
import {sourceProps} from './source-ui-props';
import {hasSourceNumericFont, SourceNumericText} from './source-text-artwork';

/** User-selected outline font follows the owning page's scale. */
export function SourceFeedbackText({text, colour = '#fff'}: {text: string; colour?: string}) {
  return <span className="source-feedback-text" data-feedback-font="xiangjiao-brush"
    style={{color: colour}}>{text}</span>;
}

/** Preserve the source control bounds and alignment with the selected text font. */
export function SourceFeedbackStaticText(props: SourceStaticTextProps) {
  const {ui, layout, name, text, suffix, className = '', style, ...attributes} = props;
  const bounds = sourceProps(ui, layout, suffix, name);
  const properties = layout.control(name).properties;
  const numeric = hasSourceNumericFont(properties.Font);
  return <span {...bounds} {...attributes} className={`source-static-text ${className}`}
    data-source-font={numeric ? properties.Font : 'xiangjiao-brush'} data-source-font-viewport="800,600"
    style={{...bounds.style, position: 'absolute', display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap',
      justifyContent: properties.HorzFormatting === 'RightAligned' ? 'flex-end' : properties.HorzFormatting === 'HorzCentred' ? 'center' : 'flex-start',
      alignItems: properties.VertFormatting === 'TopAligned' ? 'flex-start' : properties.VertFormatting === 'BottomAligned' ? 'flex-end' : 'center',
      ...style}}>
    {numeric ? <SourceNumericText font={properties.Font} text={text}/> : <SourceFeedbackText text={text}/>}
  </span>;
}
