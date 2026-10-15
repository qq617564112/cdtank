import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, extname} from 'node:path';
import type {Plugin} from 'vite';
import type {SpriteManifest} from './src/assets/sprite-images';
import type {StaticResourceAsset} from './src/assets/static-resource-cache';
import {contentAssets} from './content-assets';

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico']);

/** Use the same asset directory for startup downloads and the published game. */
export function imageAssetsPlugin(publicDir: string, contentDir: string): Plugin {
  function manifest(sourceRoot?: string, importedFiles: Iterable<string> = [],
    publishedFiles: readonly string[] = []): string {
    const images: {url: string; bytes: number; modifiedAt: number}[] = [];
    const resources = new Map<string, StaticResourceAsset>();
    const spritePath = join(publicDir, 'manifests/sprite-images.json');
    const sprites = existsSync(spritePath)
      ? JSON.parse(readFileSync(spritePath, 'utf8')) as SpriteManifest : undefined;
    const replacedImages = new Set([...Object.keys(sprites?.images ?? {}), ...Object.keys(sprites?.aliases ?? {})]);
    const entries = [sprites?.images ?? {}, ...Object.values(sprites?.scopes ?? {}).map(scope => scope.images)];
    const publishedImages = new Set(entries.flatMap(images => Object.values(images)).map(entry =>
      'atlas' in entry ? entry.atlas : entry.url));
    function visit(directory: string, prefix: string, imagesOnly = false): void {
      for (const entry of readdirSync(directory, {withFileTypes: true})) {
        const file = join(directory, entry.name);
        const path = `${prefix}/${encodeURIComponent(entry.name)}`;
        if (entry.isDirectory()) visit(file, path, imagesOnly);
        else if (entry.isFile()) {
          const image = imageExtensions.has(extname(entry.name).toLowerCase());
          if (imagesOnly && !image) continue;
          const asset = decodeURIComponent(path).replace(/^\/src\/assets\//, '/bundled-ui/');
          if (image && replacedImages.has(asset) && !publishedImages.has(asset)) continue;
          const stat = statSync(file);
          const resource = {url: path, bytes: stat.size, modifiedAt: stat.mtimeMs};
          resources.set(path, resource);
          if (image) images.push(resource);
        }
      }
    }
    visit(publicDir, '');
    for (const asset of contentAssets(contentDir)) {
      const url = `/content/${asset.path.split('/').map(encodeURIComponent).join('/')}`;
      resources.set(url, {url, bytes: asset.source.length, modifiedAt: asset.modifiedAt});
    }
    if (sourceRoot) {
      visit(join(sourceRoot, 'src'), '/src', true);
      for (const file of importedFiles) {
        if (file.startsWith(`${sourceRoot}/`) || file.startsWith(`${publicDir}/`)
          || !imageExtensions.has(extname(file).toLowerCase())) continue;
        const stat = statSync(file);
        const path = `/@fs${file.split('/').map(encodeURIComponent).join('/')}`;
        const resource = {url: path, bytes: stat.size, modifiedAt: stat.mtimeMs};
        images.push(resource);
        resources.set(path, resource);
      }
    }
    for (const path of publishedFiles) {
      const url = `/${path}`;
      if (!resources.has(url)) resources.set(url, {url, bytes: 0, modifiedAt: 0});
    }
    images.sort((left, right) => left.url.localeCompare(right.url));
    return JSON.stringify({images, sprites, resources: [...resources.values()]});
  }
  return {
    name: 'cdtank-image-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?')[0];
        if (pathname !== '/manifests/image-assets.json') {
          next();
          return;
        }
        try {
          const content = manifest(server.config.root, server.environments.client.moduleGraph.fileToModulesMap.keys());
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-cache');
          response.end(content);
        } catch (error) {
          next(error);
        }
      });
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        this.emitFile({type: 'asset', fileName: 'manifests/image-assets.json', source: manifest(undefined, [], Object.keys(bundle))});
      },
    },
  };
}
