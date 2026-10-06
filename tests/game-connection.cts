import assert from 'node:assert/strict';
import type {WsClient} from 'tsrpc-browser';
import type {ServiceType} from '../apps/shared/protocols/serviceProto';
import {GameConnection} from '../apps/web/src/network/game-connection';

interface ConnectionResult {isSucc: boolean; errMsg?: string;}
interface AccountResult {
  isSucc: boolean;
  res?: {accountId: string; token: string};
  err?: {message: string};
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
async function flush(): Promise<void> {await new Promise(resolve => setImmediate(resolve));}
function fixture() {
  const connects: Array<ReturnType<typeof deferred<ConnectionResult>>> = [];
  const accounts: Array<{request: {token?: string}; result: ReturnType<typeof deferred<AccountResult>>}> = [];
  const closes: Array<ReturnType<typeof deferred<void>>> = [];
  const flows: Array<(input: {isManual: boolean; reason: string}) => unknown> = [];
  const calls: string[] = [];
  const tokens = new Map([['cdtank-account-token', 'saved-token']]);
  const client = {
    flows: {postDisconnectFlow: {push: (flow: typeof flows[number]) => {flows.push(flow);}}},
    connect: () => {calls.push('connect'); const value = deferred<ConnectionResult>(); connects.push(value); return value.promise;},
    callApi: (name: string, request: {token?: string}) => {
      calls.push(name);
      if (name === 'Account') {
        const result = deferred<AccountResult>(); accounts.push({request, result}); return result.promise;
      }
      if (name === 'Inventory') return Promise.resolve({isSucc: true, res: {records: [], hotkeys: []}});
      if (name === 'ListMaps') return Promise.resolve({isSucc: true, res: {maps: []}});
      throw new Error(`Unexpected API ${name}`);
    },
    disconnect: () => {calls.push('disconnect'); const value = deferred<void>(); closes.push(value); return value.promise;},
  } as unknown as WsClient<ServiceType>;
  const connection = new GameConnection({client, tokenStore: {
    getItem: key => tokens.get(key) ?? null,
    setItem: (key, value) => {tokens.set(key, value);},
  }});
  async function connected(index: number): Promise<void> {
    connects[index].resolve({isSucc: true}); await flush();
  }
  function close(index: number): void {
    // TSRPC resolves disconnect and executes its post-close flow in the same close callback.
    closes[index].resolve();
    for (const flow of flows) flow({isManual: true, reason: 'Closed'});
  }
  function lost(): void {for (const flow of flows) flow({isManual: false, reason: 'Lost connection'});}
  return {connection, connects, accounts, closes, calls, tokens, connected, close, lost};
}
async function main(): Promise<void> {
  {
    const f = fixture();
    const first = f.connection.ensureConnected();
    assert.equal(f.connection.ensureConnected(), first);
    const inventory = f.connection.accounts.inventory();
    const maps = f.connection.rooms.listMaps();
    await flush();
    assert.equal(f.connects.length, 1);
    await f.connected(0);
    assert.equal(f.accounts.length, 1);
    assert.deepEqual(f.accounts[0].request, {token: 'saved-token'});
    f.accounts[0].result.resolve({isSucc: true, res: {accountId: 'A1', token: 'new-token'}});
    await Promise.all([first, inventory, maps]);
    assert.equal(f.tokens.get('cdtank-account-token'), 'new-token');
    assert.deepEqual(f.calls, ['connect', 'Account', 'Inventory', 'ListMaps']);
    assert.equal(f.connection.ensureConnected(), first);
  }
  {
    const f = fixture();
    const first = f.connection.ensureConnected();
    const failure = assert.rejects(first, /socket refused/);
    await flush();
    f.connects[0].resolve({isSucc: false, errMsg: 'socket refused'});
    await failure;
    const retry = f.connection.ensureConnected();
    await flush(); await f.connected(1);
    const denied = assert.rejects(retry, /account denied/);
    f.accounts[0].result.resolve({isSucc: false, err: {message: 'account denied'}});
    await denied;
    const accepted = f.connection.ensureConnected();
    await flush(); await f.connected(2);
    f.accounts[1].result.resolve({isSucc: true, res: {accountId: 'A1', token: 'accepted'}});
    await accepted;
    assert.equal(f.tokens.get('cdtank-account-token'), 'accepted');
  }
  for (const beginConnect of [false, true]) {
    const f = fixture();
    const stale = f.connection.accounts.inventory();
    const canceled = assert.rejects(stale, /取消/);
    if (beginConnect) {
      await flush();
      assert.equal(f.connects.length, 1);
    }
    const closed = f.connection.disconnect();
    assert.equal(f.connection.disconnect(), closed);
    assert.equal(f.closes.length, 1, 'Repeated leave shares one pending close');
    const fresh = f.connection.ensureConnected();
    await flush();
    assert.equal(f.connects.length, beginConnect ? 1 : 0);
    f.close(0); await closed; await flush();
    if (beginConnect) {
      f.connects[0].resolve({isSucc: true});
      await flush();
    }
    await canceled;
    assert.equal(f.accounts.length, 0, 'Canceled attempts cannot authenticate on a later transport');
    assert(!f.calls.includes('Inventory'), 'Canceled account wrapper cannot continue its API');
    await f.connected(beginConnect ? 1 : 0);
    assert.equal(f.accounts.length, 1);
    f.accounts[0].result.resolve({isSucc: true, res: {accountId: 'A1', token: 'fresh-token'}});
    await fresh;
  }
  for (const outcome of ['success', 'failure'] as const) {
    const f = fixture();
    const old = f.connection.ensureConnected().catch(() => {});
    await flush(); await f.connected(0);
    const closed = f.connection.disconnect();
    assert.equal(f.connection.disconnect(), closed);
    assert.equal(f.closes.length, 1, 'Repeated leave shares one pending close');
    const fresh = f.connection.ensureConnected();
    assert.equal(f.connection.ensureConnected(), fresh);
    await flush();
    assert.equal(f.connects.length, 1, 'Re-entry waits for old close');
    f.close(0); await closed; await flush();
    assert.equal(f.connection.ensureConnected(), fresh, 'Own manual close retains queued authentication');
    assert.equal(f.connects.length, 2);
    await f.connected(1);
    if (outcome === 'success') {
      f.accounts[0].result.resolve({isSucc: true, res: {accountId: 'A1', token: 'stale-token'}});
    } else {
      f.accounts[0].result.reject(new Error('stale failure'));
    }
    await old; await flush();
    assert.equal(f.connection.ensureConnected(), fresh, 'Old completion cannot clear new readiness');
    assert.equal(f.tokens.get('cdtank-account-token'), 'saved-token', 'Old token cannot replace current session');
    f.accounts[1].result.resolve({isSucc: true, res: {accountId: 'A1', token: 'fresh-token'}});
    await fresh;
    assert.equal(f.tokens.get('cdtank-account-token'), 'fresh-token');
    f.lost();
    const reconnect = f.connection.ensureConnected();
    assert.notEqual(reconnect, fresh);
    await flush(); await f.connected(2);
    assert.deepEqual(f.accounts[2].request, {token: 'fresh-token'});
    f.accounts[2].result.resolve({isSucc: true, res: {accountId: 'A1', token: 'resumed-token'}});
    await reconnect;
  }
  console.log('PASS: one authenticated transport, concurrent account/room requests, retry, close-before-reconnect, stale response/token isolation and unexpected disconnect');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
