import WebSocket from 'ws';
import {serverWebSocketUrl} from '../../shared/contracts/connection';

/** TSRPC 3.4 echoes the binary [0] heartbeat without creating an account. */
export function probeServer(serverUrl: string, timeout = 5000): Promise<number> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const socket = new WebSocket(serverWebSocketUrl(serverUrl));
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (socket.readyState === WebSocket.OPEN) socket.close();
      else socket.terminate();
      if (error) reject(error);
      else resolve(Date.now() - started);
    };
    const timer = setTimeout(() => finish(new Error('连接超时，请检查地址、主机服务和防火墙。')), timeout);
    socket.on('open', () => socket.send(Buffer.from([0])));
    socket.on('message', data => {
      if (data instanceof Buffer && data.length === 1 && data[0] === 0) finish();
      else finish(new Error('该地址未返回有效的游戏心跳。'));
    });
    socket.on('error', error => finish(new Error(`无法连接游戏服务器：${error.message}`)));
    socket.on('close', () => finish(new Error('服务器在测试完成前断开连接。')));
  });
}
