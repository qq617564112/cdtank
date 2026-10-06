export interface SourceUiFont {
  name: string;
  attributes: Record<string, string>;
  asset?: string;
  family?: string;
  glyphCount?: number;
  glyphs?: {codepoint: number; asset: string; width: number; height: number}[];
}

export interface SourceUiFontLibrary {fonts: SourceUiFont[];}

let loading: Promise<SourceUiFontLibrary> | undefined;

/** Load the actual source outline font before showing recovered source text. */
export function loadSourceUiFonts(): Promise<SourceUiFontLibrary> {
  loading ??= load().catch(error => {loading = undefined; throw error;});
  return loading;
}

async function load(): Promise<SourceUiFontLibrary> {
  const response = await fetch('/ui-fonts.json');
  if (!response.ok) throw new Error('原字体目录载入失败');
  const library = await response.json() as SourceUiFontLibrary;
  for (const font of library.fonts) {
    if (font.attributes.Type !== 'Dynamic') continue;
    if (!font.family || !font.asset) throw new Error(`原字体资源缺失：${font.name}`);
    const face = new FontFace(font.family, `url('/${font.asset}')`);
    await face.load();
    document.fonts.add(face);
  }
  return library;
}
