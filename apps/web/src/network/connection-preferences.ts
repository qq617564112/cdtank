import {normalizeServerUrl, serverWebSocketUrl, type ConnectionPreferences} from '../../../shared/contracts/connection';
import {desktopClient} from '../platform/desktop';

const STORAGE_KEY = 'cdtank.connection';

export function readConnectionPreferences(): ConnectionPreferences {
  const desktop = desktopClient();
  if (desktop) return {mode: desktop.initialState.mode, serverUrl: desktop.initialState.serverUrl};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ConnectionPreferences | null;
    if (saved?.serverUrl) return {mode: 'remote', serverUrl: normalizeServerUrl(saved.serverUrl)};
  } catch {}
  return {mode: 'remote', serverUrl: location.origin};
}

export function gameServerWebSocketUrl(): string {
  return serverWebSocketUrl(desktopClient() ? location.origin : readConnectionPreferences().serverUrl);
}

export function gameServerHttpUrl(path: string): string {
  return new URL(path, desktopClient() ? location.origin : readConnectionPreferences().serverUrl).href;
}

/** Local saves and each remote server retain their own authentication token. */
export function connectionTokenKey(): string {
  return connectionStorageKey('cdtank-account-token');
}

export function connectionStorageKey(key: string): string {
  const desktop = desktopClient();
  const preferences = readConnectionPreferences();
  if (!desktop && normalizeServerUrl(preferences.serverUrl) === location.origin) return key;
  return `${key}:${desktop && preferences.mode === 'local'
    ? 'local' : normalizeServerUrl(preferences.serverUrl)}`;
}

export function normalizeConnectionPreferences(preferences: ConnectionPreferences): ConnectionPreferences {
  if (!desktopClient() && preferences.mode === 'local') throw new Error('本地开服请使用桌面客户端。');
  const serverUrl = preferences.mode === 'remote' ? normalizeServerUrl(preferences.serverUrl)
    : preferences.serverUrl.trim() ? normalizeServerUrl(preferences.serverUrl) : '';
  if (!desktopClient() && location.protocol === 'https:' && serverUrl.startsWith('http:')) {
    throw new Error('浏览器 HTTPS 页面需要连接 HTTPS 服务器；局域网 HTTP 联机请使用桌面客户端。');
  }
  return {mode: preferences.mode, serverUrl};
}

export async function saveConnectionPreferences(preferences: ConnectionPreferences): Promise<void> {
  const next = normalizeConnectionPreferences(preferences);
  const desktop = desktopClient();
  if (desktop) await desktop.applyConnection(next);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  localStorage.removeItem('cdtank-login-session');
}

/** Test the protocol heartbeat without authenticating or allocating a guest. */
export async function testConnection(preferences: ConnectionPreferences): Promise<number> {
  const next = normalizeConnectionPreferences(preferences);
  const desktop = desktopClient();
  if (desktop) return desktop.testConnection(next);
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const socket = new WebSocket(serverWebSocketUrl(next.serverUrl));
    socket.binaryType = 'arraybuffer';
    const timer = setTimeout(() => finish(new Error('连接超时，请检查服务器地址。')), 5000);
    let settled = false;
    function finish(error?: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve(Math.round(performance.now() - started));
    }
    socket.onopen = () => socket.send(new Uint8Array([0]));
    socket.onmessage = event => {
      const data = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : undefined;
      finish(data?.length === 1 && data[0] === 0 ? undefined : new Error('该地址未返回有效的游戏心跳。'));
    };
    socket.onerror = () => finish(new Error('连接失败，请检查服务器地址、证书和网络。'));
    socket.onclose = () => finish(new Error('服务器在测试完成前断开连接。'));
  });
}
