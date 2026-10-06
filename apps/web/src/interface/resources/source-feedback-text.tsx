import './app-font.css';
import type {SourceStaticTextProps} from './source-static-text';
import {sourceProps} from './source-ui-props';

/** User-selected outline font follows the owning page's scale. */
export function SourceFeedbackText({text, colour = '#fff'}: {text: string; colour?: string}) {
  return <span data-feedback-font="xiangjiao-brush" style={{display: 'inline-block',
    verticalAlign: 'middle', fontSize: 12, lineHeight: '15px', color: colour,
    textAlign: 'left', textShadow: 'none'}}>{text}</span>;
}

/** Preserve the source control bounds and alignment with the selected text font. */
export function SourceFeedbackStaticText(props: SourceStaticTextProps) {
  const {ui, layout, name, text, suffix, className = '', ...attributes} = props;
  const bounds = sourceProps(ui, layout, suffix, name);
  const properties = layout.control(name).properties;
  return <span {...bounds} {...attributes} className={`source-static-text ${className}`}
    data-source-font="xiangjiao-brush" data-source-font-viewport="800,600"
    style={{...bounds.style, position: 'absolute', display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap',
      justifyContent: properties.HorzFormatting === 'RightAligned' ? 'flex-end' : properties.HorzFormatting === 'HorzCentred' ? 'center' : 'flex-start',
      alignItems: properties.VertFormatting === 'TopAligned' ? 'flex-start' : properties.VertFormatting === 'BottomAligned' ? 'flex-end' : 'center'}}>
    <SourceFeedbackText text={text}/>
  </span>;
}
