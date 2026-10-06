import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {defineConfig} from 'vite';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = resolve(webRoot, '../..');

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
  publicDir: resolve(workspaceRoot, process.env.CDTANK_WEB_ASSETS ?? 'recovery/output/web-assets'),
  server: {
    port: portFromEnvironment('CDTANK_WEB_PORT', 5173),
    proxy: {
      '/game': {
        target: process.env.CDTANK_GAME_SERVER ?? 'ws://127.0.0.1:3001',
        ws: true,
        rewrite: () => '/',
      },
    },
  },
  preview: {port: portFromEnvironment('CDTANK_WEB_PREVIEW_PORT', 4173)},
  build: {rollupOptions: {input: {game: resolve(webRoot, 'index.html'), validation: resolve(webRoot, 'validation.html')}}, outDir: resolve(workspaceRoot, 'dist/web'), emptyOutDir: true},
});
