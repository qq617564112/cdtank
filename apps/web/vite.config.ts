import {contentPlugin} from './content-plugin';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';
import {imageAssetsPlugin} from './image-assets-plugin';
import {webAppPlugin} from './web-app-plugin';
import {trainingDataPlugin, trainingHostPlugin} from './training-plugin';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = resolve(webRoot, '../..');
const publicDir = resolve(workspaceRoot, process.env.CDTANK_WEB_ASSETS ?? 'apps/web/public');

function portFromEnvironment(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return port;
}

export default defineConfig({
  root: webRoot,
  publicDir,
  plugins: [contentPlugin(resolve(workspaceRoot, 'apps/shared/content/definitions')),
    trainingDataPlugin(workspaceRoot), trainingHostPlugin(workspaceRoot),
    webAppPlugin(resolve(webRoot, 'game.webmanifest')),
    imageAssetsPlugin(publicDir, resolve(workspaceRoot, 'apps/shared/content/definitions'))],
  worker: {format: 'es', plugins: () => [trainingHostPlugin(workspaceRoot)]},
  server: {
    allowedHosts: ['tank.cloyd.fun'],
    fs: {allow: [workspaceRoot]},
    port: portFromEnvironment('CDTANK_WEB_PORT', 5173),
    proxy: {
      '/game': {
        target: (process.env.CDTANK_GAME_SERVER ?? 'ws://127.0.0.1:3001').replace(/^ws/, 'http'),
        ws: true,
        rewrite: path => path.replace(/^\/game/, '') || '/',
      },
    },
  },
  preview: {port: portFromEnvironment('CDTANK_WEB_PREVIEW_PORT', 4173)},
  build: {rollupOptions: {input: {game: resolve(webRoot, 'index.html'), validation: resolve(webRoot, 'validation.html')}}, outDir: resolve(workspaceRoot, 'dist/web'), emptyOutDir: true},
});
