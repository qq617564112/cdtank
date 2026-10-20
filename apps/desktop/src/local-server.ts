import {spawn, type ChildProcess} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {probeServer} from './probe';
import type {LocalCurrencyBalance, LocalCurrencyCommand, LocalCurrencyCredit, LocalCurrencyReply}
  from '../../shared/contracts/local-currency';

/** The bundled Node runtime owns the gateway and its room subprocesses. */
export class LocalServer {
  readonly url = 'http://127.0.0.1:3001';
  private child?: ChildProcess;
  private starting?: Promise<void>;
  private creditPending = false;
  private creditSequence = 0;

  constructor(private readonly runtime: string, private readonly userData: string) {}

  start(): Promise<void> {
    if (this.starting) return this.starting;
    if (this.child) return probeServer(this.url).then(() => {});
    this.starting = this.startNow().finally(() => {this.starting = undefined;});
    return this.starting;
  }

  async creditCurrency(credit: LocalCurrencyCredit): Promise<LocalCurrencyBalance> {
    if (this.creditPending) throw new Error('正在充值，请稍候。');
    this.creditPending = true;
    try {
      await this.start();
      const child = this.child;
      if (!child?.connected) throw new Error('本地服务器未连接。');
      const id = ++this.creditSequence;
      return await new Promise<LocalCurrencyBalance>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error, balance?: LocalCurrencyBalance) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          child.removeListener('message', receive);
          child.removeListener('exit', stopped);
          if (error) reject(error);
          else resolve(balance!);
        };
        const receive = (message: unknown) => {
          const reply = message as LocalCurrencyReply;
          if (reply?.type !== 'local-currency-result' || reply.id !== id) return;
          if ('error' in reply) finish(new Error(reply.error));
          else finish(undefined, reply.balance);
        };
        const stopped = () => finish(new Error('本地服务器已停止。'));
        const timer = setTimeout(() => finish(new Error('充值请求超时，请重新登录核对余额。')), 10_000);
        child.on('message', receive);
        child.once('exit', stopped);
        const command: LocalCurrencyCommand = {type: 'credit-local-currency', id, credit};
        child.send(command, error => {if (error) finish(error);});
      });
    } finally {this.creditPending = false;}
  }

  private async startNow(): Promise<void> {
    // An existing service must never silently become this client's local save.
    const occupied = await probeServer(this.url, 500).then(() => true, () => false);
    if (occupied) {
      throw new Error('本地端口 3001 已有游戏服务，请关闭该服务或使用远程模式连接。');
    }
    const log = createWriteStream(join(this.userData, 'local-server.log'), {flags: 'a'});
    const child = spawn(join(this.runtime, 'node.exe'), [join(this.runtime, 'server/server/src/index.js')], {
      cwd: this.runtime,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {...process.env, PORT: '3001',
        CONTENT_TABLES: join(this.runtime, 'content/tables'),
        SERVER_ASSETS: join(this.runtime, 'content/assets'),
        WEB_ASSETS: join(this.runtime, 'web'), WEB_ROOT: join(this.runtime, 'web'),
        ACCOUNT_DB_PATH: join(this.userData, 'state/accounts.sqlite')},
    });
    this.child = child;
    child.stdout!.pipe(log, {end: false});
    child.stderr!.pipe(log, {end: false});
    let failure: Error | undefined;
    child.on('error', error => {failure = error;});
    child.on('exit', code => {
      failure ??= new Error(`本地服务器已停止（${code ?? '进程终止'}），详情见 local-server.log。`);
      if (this.child === child) this.child = undefined;
    });
    child.once('close', () => log.end());
    try {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        if (failure) throw failure;
        try {await probeServer(this.url, 500); return;}
        catch {await delay(200);}
      }
      throw new Error('本地服务器启动超时，详情见 local-server.log。');
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = undefined;
    if (child?.pid && child.exitCode === null) {
      // Windows signals do not traverse the room-process tree.
      await new Promise<void>(resolve => {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true});
        killer.once('error', () => {child.kill(); resolve();});
        killer.once('exit', () => resolve());
      });
    }
  }
}
