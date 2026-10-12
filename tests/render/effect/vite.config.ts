import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));

export default defineConfig({
  cacheDir: fileURLToPath(new URL('../../../node_modules/.vite/render-effect', import.meta.url)),
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../../apps/web/public', import.meta.url)),
  server: {host: '127.0.0.1', port: 5206, strictPort: true, fs: {allow: [workspace]}},
  build: {
    outDir: fileURLToPath(new URL('../../../dist/validation/effect', import.meta.url)),
    emptyOutDir: true,
  },
});
