import {readdirSync, statSync} from 'node:fs';
import {join, extname} from 'node:path';
import type {Plugin} from 'vite';

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp', '.ico']);

/** Use the same asset directory for startup downloads and the published game. */
export function imageAssetsPlugin(publicDir: string): Plugin {
  function manifest(sourceRoot?: string, importedFiles: Iterable<string> = []): string {
    const images: {url: string; bytes: number; modifiedAt: number}[] = [];
    function visit(directory: string, prefix: string): void {
      for (const entry of readdirSync(directory, {withFileTypes: true})) {
        const file = join(directory, entry.name);
        const path = `${prefix}/${encodeURIComponent(entry.name)}`;
        if (entry.isDirectory()) visit(file, path);
        else if (imageExtensions.has(extname(entry.name).toLowerCase())) {
          const stat = statSync(file);
          images.push({url: path, bytes: stat.size, modifiedAt: stat.mtimeMs});
        }
      }
    }
    visit(publicDir, '');
    if (sourceRoot) {
      visit(join(sourceRoot, 'src'), '/src');
      for (const file of importedFiles) {
        if (file.startsWith(`${sourceRoot}/`) || file.startsWith(`${publicDir}/`)
          || !imageExtensions.has(extname(file).toLowerCase())) continue;
        const stat = statSync(file);
        const path = `/@fs${file.split('/').map(encodeURIComponent).join('/')}`;
        images.push({url: path, bytes: stat.size, modifiedAt: stat.mtimeMs});
      }
    }
    images.sort((left, right) => left.url.localeCompare(right.url));
    return JSON.stringify({images});
  }
  return {
    name: 'cdtank-image-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split('?')[0];
        if (pathname !== '/image-assets.json') {
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
    generateBundle() {
      this.emitFile({type: 'asset', fileName: 'image-assets.json', source: manifest()});
    },
  };
}
