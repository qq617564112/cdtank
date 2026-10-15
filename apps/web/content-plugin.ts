import {resolve, relative, sep} from 'node:path';
import type {Plugin} from 'vite';
import {contentAssets, readContentAsset} from './content-assets';

/** Serve and publish content with tank attachment data separated from the catalog. */
export function contentPlugin(root: string): Plugin {
  return {name: 'game-content',
    configureServer(server) {
      server.middlewares.use('/content', (request, response, next) => {
        const filename = resolve(root, `.${new URL(request.url ?? '/', 'http://localhost').pathname}`);
        if (!filename.startsWith(root + sep)) return next();
        try {
          const asset = readContentAsset(root, relative(root, filename).split(sep).join('/'));
          if (!asset) return next();
          response.setHeader('Content-Type', asset.path.endsWith('.bin') ? 'application/octet-stream' : 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-cache');
          response.end(asset.source);
        } catch {next();}
      });
    },
    generateBundle() {
      for (const asset of contentAssets(root)) this.emitFile({type: 'asset',
        fileName: `content/${asset.path}`, source: asset.source});
    },
  };
}
