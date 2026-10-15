import {readFileSync} from 'node:fs';
import type {Plugin} from 'vite';

/** Keep the installed app's manifest address stable across program releases. */
export function webAppPlugin(manifestFile: string): Plugin {
  const manifestUrl = '/manifests/game.webmanifest';
  return {
    name: 'game-web-app',
    transformIndexHtml: {
      order: 'post',
      handler: () => [{tag: 'link', attrs: {rel: 'manifest', href: manifestUrl}, injectTo: 'head'}],
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== manifestUrl) return next();
        response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(readFileSync(manifestFile));
      });
    },
    generateBundle() {
      this.emitFile({type: 'asset', fileName: manifestUrl.slice(1), source: readFileSync(manifestFile)});
    },
  };
}
