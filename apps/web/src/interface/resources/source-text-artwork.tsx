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
  weight?: number;
  italic?: boolean;
  shadow?: string;
  shadowX?: number;
  shadowY?: number;
  outlineLayers?: {colour: string; stroke: number}[];
  outlineGradient?: {from: string; to: string; top: number; height: number};
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
    textShadow: text.shadow ? `${text.shadowX}px ${text.shadowY}px 0 ${text.shadow}` : 'none',
    fontWeight: text.weight ?? 700, fontStyle: text.italic ? 'italic' : 'normal'};
}

/** Outline bands share the fill's font geometry and source coordinates. */
function inkLayers(text: SourceTextStyle): CSSProperties[] {
  const fill = inkStyle(text);
  if (text.outlineGradient) {
    const gradient = text.outlineGradient;
    const from = gradient.from.slice(1), to = gradient.to.slice(1);
    const rgb = (value: string) => {
      const hex = value.length === 3 ? [...value].map(char => char + char).join('') : value;
      return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    };
    const start = rgb(from), end = rgb(to);
    const top = gradient.top - text.stroke / 2;
    const height = gradient.height + text.stroke;
    return [...Array.from({length: 16}, (_, index) => {
      const colour = start.map((value, channel) => Math.round(value + (end[channel] - value) * index / 15));
      return {...fill, color: 'transparent', textShadow: 'none',
        WebkitTextStroke: `${text.stroke}px rgb(${colour.join(',')})`,
        clipPath: `inset(${top + height * index / 16}px -10px ${text.lineHeight - top - height * (index + 1) / 16}px -10px)`};
    }), {...fill, WebkitTextStroke: '0', textShadow: 'none'}];
  }
  if (text.outlineLayers) {
    return [...text.outlineLayers.map(layer => ({...fill, color: 'transparent', textShadow: 'none',
      WebkitTextStroke: `${layer.stroke}px ${layer.colour}`})), {...fill, WebkitTextStroke: '0'}];
  }
  return [fill];
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
    for (const layer of inkLayers(run)) {
      const {WebkitTextStroke: stroke, ...properties} = layer;
      const ink = document.createElement('span');
      ink.className = 'source-text-ink';
      ink.dataset.sourceTextFace = run.face;
      ink.textContent = run.text;
      Object.assign(ink.style, {
        ...properties, left: `${run.x}px`, top: `${run.y}px`, fontSize: `${run.size}px`,
        fontWeight: String(run.weight ?? 700),
      });
      ink.style.setProperty('-webkit-text-stroke', String(stroke));
      coordinates.append(ink);
    }
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
      {(text.runs ?? [text]).flatMap((run, index) => inkLayers(run).map((layer, layerIndex) =>
        <span key={`${index}-${layerIndex}`} className="source-text-ink"
          data-source-text-face={run.face} style={layer}>{run.text}</span>))}
    </span>
  </span>;
}
