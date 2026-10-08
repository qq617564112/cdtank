import {readFileSync, readdirSync} from 'node:fs';
import {resolve, relative, sep} from 'node:path';
import type {Plugin} from 'vite';

/** Serve and publish the editable per-entity definitions without embedding them in JavaScript. */
export function contentPlugin(root: string): Plugin {
  const files = (): string[] => ['index.json', ...readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory()).flatMap(directory => readdirSync(resolve(root, directory.name))
      .filter(filename => filename.endsWith('.json')).map(filename => `${directory.name}/${filename}`))];
  return {name: 'game-content',
    configureServer(server) {
      server.middlewares.use('/content', (request, response, next) => {
        const filename = resolve(root, `.${new URL(request.url ?? '/', 'http://localhost').pathname}`);
        if (!filename.startsWith(root + sep) || !filename.endsWith('.json')) return next();
        try {
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-cache');
          response.end(readFileSync(filename));
        } catch {next();}
      });
    },
    generateBundle() {
      for (const filename of files()) this.emitFile({type: 'asset',
        fileName: `content/${relative(root, resolve(root, filename)).split(sep).join('/')}`,
        source: readFileSync(resolve(root, filename))});
    },
  };
}
