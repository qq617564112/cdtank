import {app, BrowserWindow, dialog, ipcMain} from 'electron';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {networkInterfaces} from 'node:os';
import {join, resolve} from 'node:path';
import {normalizeServerUrl, type ConnectionPreferences, type DesktopConnectionState} from '../../shared/contracts/connection';
import {DesktopGateway} from './gateway';
import {LocalServer} from './local-server';
import {probeServer} from './probe';
import type {LocalCurrencyCredit} from '../../shared/contracts/local-currency';

let window: BrowserWindow | undefined;
let gateway: DesktopGateway | undefined;
let local: LocalServer | undefined;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('客户端启动失败', error instanceof Error ? error.message : String(error));
    app.quit();
  });
}

async function start(): Promise<void> {
  const runtime = app.isPackaged ? join(process.resourcesPath, 'runtime')
    : resolve(__dirname, '../../../dist/desktop/runtime');
  const userData = app.getPath('userData');
  mkdirSync(userData, {recursive: true});
  const preferencesFile = join(userData, 'connection.json');
  let preferences: ConnectionPreferences = {mode: 'local', serverUrl: ''};
  try {
    const saved = JSON.parse(readFileSync(preferencesFile, 'utf8')) as ConnectionPreferences;
    if (saved.mode === 'local' || saved.mode === 'remote') preferences = {
      mode: saved.mode, serverUrl: saved.serverUrl ? normalizeServerUrl(saved.serverUrl) : '',
    };
    if (preferences.mode === 'remote' && !preferences.serverUrl) preferences.mode = 'local';
  } catch {}
  local = new LocalServer(runtime, userData);
  let startupError: string | undefined;
  if (preferences.mode === 'local') {
    try {await local.start();}
    catch (error) {startupError = error instanceof Error ? error.message : String(error);}
  }
  gateway = new DesktopGateway(join(runtime, 'web'), () =>
    preferences.mode === 'local' ? local!.url : preferences.serverUrl);
  const origin = await gateway.start();
  const state = (): DesktopConnectionState => ({...preferences, localUrl: local!.url, startupError,
    lanUrls: Object.values(networkInterfaces()).flatMap(addresses => (addresses ?? [])
      .filter(address => address.family === 'IPv4' && !address.internal)
      .map(address => `http://${address.address}:3001`))});
  ipcMain.on('desktop:state', event => {event.returnValue = state();});
  ipcMain.handle('desktop:credit-currency', (_event, credit: LocalCurrencyCredit) => {
    if (preferences.mode !== 'local') throw new Error('请先切换到本地模式。');
    return local!.creditCurrency(credit);
  });
  ipcMain.handle('desktop:test', async (_event, input: ConnectionPreferences) => {
    if (input.mode === 'local') {
      try {await local!.start(); return await probeServer(local!.url);}
      finally {if (preferences.mode === 'remote') await local!.stop();}
    }
    return probeServer(normalizeServerUrl(input.serverUrl));
  });
  ipcMain.handle('desktop:apply', async (_event, input: ConnectionPreferences) => {
    if (input.mode !== 'local' && input.mode !== 'remote') throw new Error('运行模式无效。');
    const next: ConnectionPreferences = {mode: input.mode,
      serverUrl: input.serverUrl ? normalizeServerUrl(input.serverUrl) : ''};
    if (next.mode === 'remote' && !next.serverUrl) throw new Error('请填写服务器地址。');
    if (next.mode === 'local') await local!.start();
    writeFileSync(preferencesFile, JSON.stringify(next, null, 2) + '\n');
    gateway!.disconnect();
    preferences = next;
    startupError = undefined;
    if (next.mode === 'remote') await local!.stop();
  });
  window = new BrowserWindow({width: 1280, height: 800, minWidth: 960, minHeight: 640,
    title: '猫狗大作战', autoHideMenuBar: true, backgroundColor: '#302819',
    icon: join(runtime, 'web/assets/ui/images/app-icons/client-icon-512.png'),
    webPreferences: {preload: join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true}});
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  await window.loadURL(`${origin}/login`);
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  gateway?.close();
  void (local?.stop() ?? Promise.resolve()).finally(() => app.quit());
});
