import {useEffect, useSyncExternalStore, type ReactNode} from 'react';
import {decodeImageRegion} from '../../assets/image-resources';
import {imageResourceUrl} from '../../assets/image-cache';
import {loadStaticJson} from '../../assets/static-resources';

export interface SourceBitmapGlyph {
  codepoint: number;
  asset: string;
  width: number;
  height: number;
}

export interface SourceBitmapFont {
  name: string;
  attributes: Record<string, string>;
  glyphs: readonly SourceBitmapGlyph[];
  glyphsByCodepoint: ReadonlyMap<number, SourceBitmapGlyph>;
}

interface SourceUiFontLibrary {
  fonts: {
    name: string;
    attributes: Record<string, string>;
    glyphs?: readonly SourceBitmapGlyph[];
  }[];
}

const fonts = new Map<string, SourceBitmapFont>();
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;
let version = 0;

function notify(): void {
  version++;
  for (const listener of listeners) listener();
}

/** Decode every published source-font glyph before controls consume it. */
export function loadSourceBitmapFonts(): Promise<void> {
  loading ??= loadStaticJson<SourceUiFontLibrary>('/manifests/ui-fonts.json').then(async library => {
    const faces = library.fonts.filter(font => font.glyphs?.length);
    await Promise.all([...new Set(faces.flatMap(font => font.glyphs!.map(glyph => glyph.asset)))]
      .map(asset => decodeImageRegion(`/${asset}`)));
    fonts.clear();
    for (const face of faces) {
      const glyphs = face.glyphs!;
      fonts.set(face.name, {
        name: face.name,
        attributes: face.attributes,
        glyphs,
        glyphsByCodepoint: new Map(glyphs.map(glyph => [glyph.codepoint, glyph])),
      });
    }
    notify();
  }).catch(error => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export function sourceBitmapFont(name?: string): SourceBitmapFont | undefined {
  return name ? fonts.get(name) : undefined;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useSourceBitmapFont(name?: string): SourceBitmapFont | undefined {
  useSyncExternalStore(subscribe, () => version, () => version);
  useEffect(() => {void loadSourceBitmapFonts();}, []);
  return sourceBitmapFont(name);
}

/** Original source-font glyph images retain their published metrics and pixels. */
export function SourceBitmapText({text, font, className = '', fallback, ariaLabel}: {
  text: string;
  font: string;
  className?: string;
  fallback?: ReactNode;
  ariaLabel?: string;
}) {
  const face = useSourceBitmapFont(font);
  const label = ariaLabel ?? text.replace(/#/g, '∞').replace(/\*/g, '×');
  if (!face) {
    return <span className={className} data-source-font={font} role="img" aria-label={label}>{fallback ?? text}</span>;
  }
  const characters = [...text];
  const glyphs = characters.flatMap(character => {
    const glyph = face.glyphsByCodepoint.get(character.codePointAt(0)!);
    return glyph ? [glyph] : [];
  });
  if (glyphs.length !== characters.length) {
    return <span className={className} data-source-font={font} role="img" aria-label={label}>{fallback ?? text}</span>;
  }
  return <span className={className} data-source-font={font} data-source-bitmap-font={font} role="img" aria-label={label}
    style={{display: 'inline-flex', alignItems: 'flex-start', flex: '0 0 auto', whiteSpace: 'nowrap', verticalAlign: 'top'}}>
    {glyphs.map((glyph, index) => <img key={`${glyph.codepoint}-${index}`} src={imageResourceUrl(`/${glyph.asset}`)}
      alt="" aria-hidden="true" draggable={false} data-source-text-image={glyph.asset}
      width={glyph.width} height={glyph.height}
      style={{display: 'block', flex: '0 0 auto', width: glyph.width, height: glyph.height}} />)}
  </span>;
}

export function SourceNumericText({text, font}: {text: string; font: string}) {
  return <SourceBitmapText text={text} font={font} className="source-numeric-text"/>;
}

/** Original static-font metrics for an explicitly supplied source display size. */
export function mediumHtMetrics(glyphs: readonly SourceBitmapGlyph[], sourceViewport: {width: number; height: number}) {
  const horizontal = Math.fround(Math.fround(sourceViewport.width) / 800);
  const vertical = Math.fround(Math.fround(sourceViewport.height) / 600);
  const scaled = glyphs.map(glyph => ({...glyph,
    width: Math.round(Math.fround(glyph.width * horizontal)),
    height: Math.round(Math.fround(glyph.height * vertical)),
    // Original x87 ftol truncates the native integer advance times the stored f32 factor.
    advance: Math.trunc(glyph.width * horizontal)}));
  const lineSpacing = Math.fround(Math.max(0, ...scaled.map(glyph => glyph.height)) * vertical);
  return {glyphs: scaled, lineSpacing, baseline: 0};
}
