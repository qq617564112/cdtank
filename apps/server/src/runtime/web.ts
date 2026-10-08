import type {IncomingMessage, Server, ServerResponse} from 'node:http';
import {resolve, sep} from 'node:path';
import compression from 'compression';
import serveStatic from 'serve-static';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';

export function hostWeb(server: WsServer<ServiceType>, webRoot: string): void {
  const assetPrefix = resolve(webRoot, 'assets') + sep;
  const files = serveStatic(webRoot, {
    redirect: false,
    fallthrough: false,
    setHeaders(response, filename) {
      response.setHeader('Cache-Control', filename.startsWith(assetPrefix)
        ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });
  const compress = compression({
    level: 4,
    threshold: 1024,
    filter(request, response) {
      return response.statusCode !== 206 && compression.filter(request, response);
    },
  }) as unknown as (
    request: IncomingMessage, response: ServerResponse, next: () => void
  ) => void;
  // TSRPC 3.4.21 keeps its HTTP listener private; attach after start() resolves.
  const listener = Reflect.get(server, '_httpServer') as Server;
  listener.on('request', (request, response) => {
    compress(request, response, () => {
      files(request, response, error => {
        response.statusCode = error?.statusCode ?? 404;
        if (error?.headers) {
          for (const [name, value] of Object.entries(error.headers)) {
            response.setHeader(name, value as string);
          }
        }
        if (response.statusCode >= 500) console.error('Static file request failed', error);
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.end(response.statusCode >= 500 ? 'Unable to serve file' : 'Not found');
      });
    });
  });
  console.log(`Web root: ${webRoot}`);
}
