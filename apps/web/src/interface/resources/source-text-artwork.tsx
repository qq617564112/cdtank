import {useLayoutEffect, useRef, type CSSProperties} from 'react';
import './source-text-artwork.css';
import {buttonArtwork} from '../../assets/button-artwork';

export interface SourceTextStyle {
  text: string;
  width: number;
  height: number;
  face: string;
  size: number;
  lineHeight: number;
  x: number;
  y: number;
  scaleX: number;
  colour: string;
  outline: string;
  stroke: number;
  shadow?: string;
  shadowX?: number;
  shadowY?: number;
  runs?: SourceTextStyle[];
}

export function sourceTextArtwork(asset?: string): SourceTextStyle | undefined {
  const button = asset ? buttonArtwork(asset) : undefined;
  return button?.background ? button.text : undefined;
}

function inkStyle(text: SourceTextStyle): CSSProperties {
  return {left: text.x, top: text.y, fontSize: text.size, lineHeight: `${text.lineHeight}px`,
    transform: `scaleX(${text.scaleX})`, color: text.colour,
    WebkitTextStroke: `${text.stroke}px ${text.outline}`,
    textShadow: text.shadow ? `${text.shadowX}px ${text.shadowY}px 0 ${text.shadow}` : 'none'};
}

/** Use the same source coordinates for named images embedded in rich chat. */
export function createSourceTextArtwork(asset: string): HTMLSpanElement {
  const text = sourceTextArtwork(asset)!;
  const bounds = document.createElement('span');
  bounds.className = 'source-text-artwork';
  bounds.dataset.sourceTextImage = asset;
  bounds.dataset.sourceTextValue = text.text;
  bounds.setAttribute('aria-hidden', 'true');
  const coordinates = document.createElement('span');
  coordinates.className = 'source-text-coordinates';
  coordinates.style.width = `${text.width}px`;
  coordinates.style.height = `${text.height}px`;
  for (const run of text.runs ?? [text]) {
    const ink = document.createElement('span');
    ink.className = 'source-text-ink';
    ink.dataset.sourceTextFace = run.face;
    ink.textContent = run.text;
    Object.assign(ink.style, {
      left: `${run.x}px`, top: `${run.y}px`, fontSize: `${run.size}px`,
      lineHeight: `${run.lineHeight}px`, transform: `scaleX(${run.scaleX})`,
      color: run.colour, WebkitTextStroke: `${run.stroke}px ${run.outline}`,
      textShadow: run.shadow ? `${run.shadowX}px ${run.shadowY}px 0 ${run.shadow}` : 'none',
    });
    coordinates.append(ink);
  }
  bounds.append(coordinates);
  return bounds;
}

/** Live outline text occupies the original image's ink and transparent margins. */
export function SourceTextArtwork({asset, style}: {asset: string; style?: CSSProperties}) {
  const text = sourceTextArtwork(asset)!;
  const bounds = useRef<HTMLSpanElement>(null), coordinates = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = bounds.current!, content = coordinates.current!;
    const resize = () => {
      content.style.transform = `scale(${element.clientWidth / text.width}, ${element.clientHeight / text.height})`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);
  return <span ref={bounds} className="source-text-artwork" style={style} role="img" aria-label={text.text}
    data-source-text-image={asset} data-source-text-value={text.text}>
    <span ref={coordinates} className="source-text-coordinates" aria-hidden="true" style={{width: text.width, height: text.height}}>
      {(text.runs ?? [text]).map((run, index) => <span key={index} className="source-text-ink"
        data-source-text-face={run.face} style={inkStyle(run)}>{run.text}</span>)}
    </span>
  </span>;
}
