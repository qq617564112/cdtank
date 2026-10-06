export interface SourceFontGlyph {codepoint: number; advance: number; inkX: number; inkY: number; width: number; height: number; x: number; y: number;}
export interface SourceFontRasterFace {dpi: number; pointSize: number; nativeResolution: [number, number]; lineSpacing: number; baseline: number; atlas: {asset: string; width: number; height: number}; glyphs: SourceFontGlyph[];}
export interface SourceFontRasterLibrary {status: string; font: string; source: string; faces: SourceFontRasterFace[];}
let sourceFontRaster: Promise<SourceFontRasterLibrary> | undefined;
export function loadSourceFontRaster(): Promise<SourceFontRasterLibrary> {
  sourceFontRaster ??= fetch('/ui-font-raster.json').then(async response => {if (!response.ok) throw new Error('原SIMSUN点阵目录载入失败'); const library = await response.json() as SourceFontRasterLibrary; await Promise.all(library.faces.map(async face => {const image = new Image(); image.src = `/${face.atlas.asset}`; await image.decode();})); return library;});
  return sourceFontRaster;
}
export function sourceFontFace(library: SourceFontRasterLibrary, scale: number): SourceFontRasterFace {
  const dpi = Math.round(96 * scale);
  return library.faces.reduce((best, face) => Math.abs(face.dpi - dpi) < Math.abs(best.dpi - dpi) ? face : best, library.faces[0]);
}
