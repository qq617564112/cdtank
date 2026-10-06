import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

const workspace = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../recovery/output/web-assets', import.meta.url)),
  server: {host: '127.0.0.1', port: 5211, strictPort: true, fs: {allow: [workspace]}},
  build: {
    outDir: fileURLToPath(new URL('../../dist/tools/asset-viewer', import.meta.url)),
    emptyOutDir: true,
  },
});
