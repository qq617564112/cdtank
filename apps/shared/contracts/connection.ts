import type {LocalCurrencyBalance, LocalCurrencyCredit} from './local-currency';

export interface ConnectionPreferences {
  mode: 'local' | 'remote';
  serverUrl: string;
}

export interface DesktopConnectionState extends ConnectionPreferences {
  localUrl: string;
  lanUrls: string[];
  startupError?: string;
}

export interface DesktopClient {
  initialState: DesktopConnectionState;
  applyConnection(preferences: ConnectionPreferences): Promise<void>;
  testConnection(preferences: ConnectionPreferences): Promise<number>;
  creditLocalCurrency(credit: LocalCurrencyCredit): Promise<LocalCurrencyBalance>;
}

/** Addresses entered without a scheme use the host's plain HTTP service. */
export function normalizeServerUrl(input: string): string {
  const value = input.trim();
  if (!value) throw new Error('请填写服务器地址。');
  let url: URL;
  try {url = new URL(value.includes('://') ? value : `http://${value}`);}
  catch {throw new Error('服务器地址无效，请填写 IP:端口或完整 URL。');}
  if (url.protocol === 'ws:') url.protocol = 'http:';
  if (url.protocol === 'wss:') url.protocol = 'https:';
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('请填写 HTTP 或 HTTPS 服务器地址。');
  }
  return url.origin;
}

export function serverWebSocketUrl(serverUrl: string): string {
  return `${normalizeServerUrl(serverUrl).replace(/^http/, 'ws')}/game`;
}
