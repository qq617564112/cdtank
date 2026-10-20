import {createServer, request as httpRequest, type IncomingMessage, type ServerResponse} from 'node:http';
import {request as httpsRequest} from 'node:https';
import type {Socket} from 'node:net';
import {resolve} from 'node:path';
import serveStatic from 'serve-static';
import WebSocket from 'ws';
import {serverWebSocketUrl} from '../../shared/contracts/connection';

/** The renderer keeps a trusted loopback origin for WebGPU in both modes. */
export class DesktopGateway {
  private readonly server = createServer((request, response) => this.handle(request, response));
  private readonly sockets = new Set<WebSocket>();
  private readonly webSockets = new WebSocket.Server({noServer: true});
  private readonly files: ReturnType<typeof serveStatic>;

  constructor(webRoot: string, private readonly target: () => string) {
    this.files = serveStatic(resolve(webRoot), {redirect: false, setHeaders: response => {
      response.setHeader('Cache-Control', 'no-cache');
    }});
    this.server.on('upgrade', (request, socket, head) => {
      if (request.url?.split('?')[0] !== '/game') {socket.destroy(); return;}
      this.connect(request, socket as Socket, head);
    });
  }

  start(): Promise<string> {
    return new Promise((resolveReady, reject) => {
      this.server.once('error', reject);
      this.server.listen(3002, '127.0.0.1', () => {
        this.server.removeListener('error', reject);
        resolveReady('http://127.0.0.1:3002');
      });
    });
  }

  private handle(request: IncomingMessage, response: ServerResponse): void {
    const pathname = (request.url ?? '/').split('?')[0];
    if (/^\/(?:game\/)?api\//.test(pathname)) {
      const url = new URL(request.url ?? '/', this.target());
      const upstream = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
        method: request.method, headers: {...request.headers, host: url.host},
      }, incoming => {
        response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.pipe(response);
      });
      upstream.setTimeout(15_000, () => upstream.destroy(new Error('服务器请求超时')));
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502);
        response.end('无法连接游戏服务器');
      });
      response.on('close', () => upstream.destroy());
      request.pipe(upstream);
      return;
    }
    if (/^\/(?:login|channels|lobby|closed|quick-start(?:\/team-12)?|rooms\/[^/]+(?:\/(?:battle|results))?)\/?$/.test(pathname)) {
      request.url = '/index.html';
    }
    this.files(request, response, error => {
      response.statusCode = error?.statusCode ?? 404;
      response.end('资源不可用');
    });
  }

  private connect(request: IncomingMessage, socket: Socket, head: Buffer): void {
    // Finish the upstream handshake before accepting the renderer's first packet.
    const upstream = new WebSocket(serverWebSocketUrl(this.target()), {handshakeTimeout: 5000});
    this.sockets.add(upstream);
    socket.once('close', () => {
      if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
      else upstream.close();
    });
    upstream.on('error', () => socket.destroy());
    upstream.once('close', () => {this.sockets.delete(upstream); socket.destroy();});
    upstream.once('open', () => this.webSockets.handleUpgrade(request, socket, head, downstream => {
      this.sockets.add(downstream);
      downstream.on('message', data => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
      });
      upstream.on('message', data => {
        if (downstream.readyState === WebSocket.OPEN) downstream.send(data);
      });
      downstream.on('error', () => upstream.terminate());
      downstream.once('close', () => {this.sockets.delete(downstream); upstream.close();});
    }));
  }

  disconnect(): void {
    for (const socket of this.sockets) socket.terminate();
    this.sockets.clear();
  }

  close(): void {
    this.disconnect();
    this.webSockets.close();
    this.server.close();
    this.server.closeAllConnections();
  }
}
