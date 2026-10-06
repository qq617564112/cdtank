import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));

export default defineConfig({
  cacheDir: fileURLToPath(new URL('../../../node_modules/.vite/render-effect-particle', import.meta.url)),
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../../recovery/output/web-assets', import.meta.url)),
  server: {host: '127.0.0.1', port: 5207, strictPort: true, fs: {allow: [workspace]}},
  build: {
    outDir: fileURLToPath(new URL('../../../dist/validation/effect-particle', import.meta.url)),
    emptyOutDir: true,
  },
});
