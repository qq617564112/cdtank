import {useLayoutEffect, useRef, type CSSProperties} from 'react';
import catalogue from './source-text-artwork.json';
import './source-text-artwork.css';
import './source-text-artwork-generated.css';
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

const assets: Readonly<Record<string, SourceTextStyle>> = catalogue.assets;
const numeric: Readonly<Record<string, Readonly<Record<string, string>>>> = catalogue.numeric;
const replacedImages = new Set<string>(catalogue.replacedImages);

export function sourceTextArtwork(asset?: string): SourceTextStyle | undefined {
  return asset ? assets[asset] ?? buttonArtwork(asset)?.text : undefined;
}

export function isSourceTextImage(path: string): boolean {
  return replacedImages.has(path.replace(/^\//, ''));
}

export function hasSourceNumericFont(name?: string): boolean {
  return name !== undefined && numeric[name] !== undefined;
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

/** Keep each source glyph's advance, palette and outline for changing values. */
export function SourceNumericText({text, font}: {text: string; font: string}) {
  const glyphs = numeric[font];
  const sample = assets[Object.values(glyphs)[0]];
  return <span className="source-numeric-text" data-source-numeric-font={font}
    role="img" aria-label={text.replace(/#/g, '∞').replace(/\*/g, '×')}>
    {[...text].map((character, index) => {
      const visible = character === '#' ? '∞' : character === '*' ? '×' : character;
      const asset = glyphs[visible];
      const glyph = asset ? assets[asset] : undefined;
      return glyph ? <span key={index} className="source-text-glyph" aria-hidden="true"
        data-source-text-image={asset} style={{width: glyph.width, height: glyph.height}}>
        <span className="source-text-ink" data-source-text-face={glyph.face} style={inkStyle(glyph)}>{visible}</span>
      </span> : <span key={index} className="source-numeric-fallback" data-source-text-face="digits"
        aria-hidden="true" style={{fontSize: sample.size, lineHeight: `${sample.height}px`,
          color: sample.colour, WebkitTextStroke: `${sample.stroke}px ${sample.outline}`}}>{visible}</span>;
    })}
  </span>;
}
