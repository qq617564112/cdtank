import assert from 'node:assert/strict';
import type {WsClient} from 'tsrpc-browser';
import type {ServiceType} from '../apps/shared/protocols/serviceProto';
import type {ReqAccount} from '../apps/shared/protocols/PtlAccount';
import {GameConnection} from '../apps/web/src/network/game-connection';

async function main() {
  const storage = new Map([['cdtank-account-token', 'existing-token']]);
  const calls: Array<{api: string; request?: unknown}> = [];
  let reject = false;
  const client = {
    flows: {postDisconnectFlow: {push: () => {}}},
    connect: async () => {calls.push({api: 'connect'}); return {isSucc: true};},
    disconnect: async () => {calls.push({api: 'disconnect'});},
    callApi: async (api: string, request: ReqAccount) => {
      calls.push({api, request});
      if (reject) return {isSucc: false, err: {message: '账号或密码错误'}};
      if (api === 'Channel') return {isSucc: true, res: {channels: [], enteredChannelId: 'main'}};
      return {isSucc: true, res: {accountId: 'retained-account', token: 'existing-token', accountName: '账号'}};
    },
  } as unknown as WsClient<ServiceType>;
  const connection = new GameConnection({client, tokenStore: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => {storage.set(key, value);},
  }});
  await connection.authenticate({operation: 'REGISTER', account: '账号', password: '密码'});
  assert.deepEqual(calls.slice(0, 3).map(call => call.api), ['disconnect', 'connect', 'Account']);
  assert.deepEqual(calls[2].request, {token: 'existing-token', credentials: {operation: 'REGISTER', account: '账号', password: '密码'}});
  await connection.channels('main');
  assert.equal(calls.filter(call => call.api === 'Account').length, 1);
  reject = true;
  await assert.rejects(connection.authenticate({operation: 'LOGIN', account: '账号', password: '错误'}), /账号或密码错误/);
  assert.equal(storage.get('cdtank-account-token'), 'existing-token');
  const attempt = calls.at(-1)!.request as ReqAccount;
  assert.equal(attempt.token, undefined);
  reject = false;
  await connection.authenticate();
  assert.deepEqual(calls.at(-1)!.request, {token: 'existing-token', credentials: undefined});
  assert.deepEqual([...storage.keys()], ['cdtank-account-token']);
  console.log('PASS_LOGIN_REGISTER_RESTORE_SINGLE_CONNECTION_REJECTION_PASSWORD_NOT_STORED');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
