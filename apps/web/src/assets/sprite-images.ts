export interface SpriteRegion {
  atlas: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StandaloneImage {
  url: string;
  width?: number;
  height?: number;
}

interface SpriteAtlas {
  url: string;
  width: number;
  height: number;
}

export interface SpriteManifest {
  atlases: SpriteAtlas[];
  images: Record<string, SpriteRegion | StandaloneImage>;
  aliases: Record<string, string>;
}

let manifest: SpriteManifest | undefined;
const bundledAliases = new Map<string, string>();
const atlases = new Map<string, SpriteAtlas>();

/** Match both public asset paths and Vite's published URLs for bundled artwork. */
export function prepareSpriteImages(value: SpriteManifest | undefined, bundled: Record<string, string>): void {
  manifest = value;
  bundledAliases.clear();
  atlases.clear();
  for (const atlas of value?.atlases ?? []) atlases.set(atlas.url, atlas);
  for (const [path, url] of Object.entries(bundled)) {
    if (!path.startsWith('../assets/')) continue;
    const address = new URL(url, location.href);
    const asset = `/bundled-ui/${path.slice('../assets/'.length)}`;
    bundledAliases.set(address.href, asset);
    if (address.origin === location.origin) bundledAliases.set(address.pathname, asset);
  }
}

export function spriteImage(url: string): SpriteRegion | StandaloneImage | undefined {
  if (!manifest) return undefined;
  const address = new URL(url, location.href);
  const bundled = bundledAliases.get(address.href) ?? bundledAliases.get(address.pathname);
  if (!bundled && address.origin !== location.origin) return undefined;
  const path = bundled ?? decodeURIComponent(address.pathname);
  return manifest.images[manifest.aliases[path] ?? path];
}

export function spriteRegion(url: string): SpriteRegion | undefined {
  const image = spriteImage(url);
  return image && 'atlas' in image ? image : undefined;
}

export function spriteAtlas(url: string): SpriteAtlas | undefined {
  return atlases.get(url);
}

/** An atlas owns the network download and cache entry for all its regions. */
export function publishedImageUrl(url: string): string {
  const image = spriteImage(url);
  if (!image) return url;
  const published = 'atlas' in image ? image.atlas : image.url;
  return published + new URL(url, location.href).hash;
}
