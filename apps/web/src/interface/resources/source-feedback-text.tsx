import './app-font.css';
import type {SourceStaticTextProps} from './source-static-text';
import {sourceProps} from './source-ui-props';
import {SourceBitmapText} from './source-bitmap-font';

/** Original dynamic face follows the owning page's scale. */
export function SourceFeedbackText({text, colour = '#fff'}: {text: string; colour?: string}) {
  return <span className="source-feedback-text" data-feedback-font="SIMSUN"
    style={{color: colour}}>{text}</span>;
}

/** Preserve the source control bounds and alignment with the original text font. */
export function SourceFeedbackStaticText(props: SourceStaticTextProps) {
  const {ui, layout, name, text, suffix, className = '', style, ...attributes} = props;
  const bounds = sourceProps(ui, layout, suffix, name);
  const properties = layout.control(name).properties;
  return <span {...bounds} {...attributes} className={`source-static-text ${className}`}
    data-source-font={properties.Font ?? 'SIMSUN'} data-source-font-viewport="800,600"
    style={{...bounds.style, position: 'absolute', display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap',
      justifyContent: properties.HorzFormatting === 'RightAligned' ? 'flex-end' : properties.HorzFormatting === 'HorzCentred' ? 'center' : 'flex-start',
      alignItems: properties.VertFormatting === 'TopAligned' ? 'flex-start' : properties.VertFormatting === 'BottomAligned' ? 'flex-end' : 'center',
      ...style}}>
    <SourceBitmapText font={properties.Font} text={text} fallback={<SourceFeedbackText text={text}/>}/>
  </span>;
}
