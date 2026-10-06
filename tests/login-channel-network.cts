import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}
async function main() {
  assert.equal(process.env.LOGIN_CHANNEL_RELEASE, '1');
  const port = 3637;
  const source = 'recovery/output/shot-hurt-resistance-network-2026-10-05T23-18-45-702Z';
  const identity = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8'));
  const accounts = identity.accounts as Array<{accountId: string; token: string}>;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-login-channel-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const stem = 'recovery/output/login-channel-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const name = '登录验收' + Date.now().toString().slice(-10), password = '普通登录密码';
  const clients = [0, 1, 2].map(() => new WsClient<ServiceType>(serviceProto, {server: `ws://127.0.0.1:${port}`, logger: undefined}));
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, source, scope: 'Named registration binds existing identity; credential failures/channel rejection/full native preservation/sameDBrestart',
    fixture: {clonedAcceptedDatabase: true, fundsInjected: false, pointsInjected: false, ownedInjected: false}};
  let server: ChildProcess | undefined, log = '';
  async function start() {
    const offset = log.length;
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);}); server.stderr!.on('data', data => {log += String(data);});
    const deadline = Date.now() + 15000;
    while (!log.slice(offset).includes(`Server started at ${port}.`) && Date.now() < deadline && server.exitCode === null) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(log.slice(offset).includes(`Server started at ${port}.`), log);
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop() {
    await Promise.all(clients.map(client => client.disconnect()));
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve)); server.kill(); await closed;
    }
  }
  async function query(i: number) {
    return {
      inventory: await must(clients[i].callApi('Inventory', {})),
      equipment: await must(clients[i].callApi('Equipment', {operation: 'QUERY'})),
      owned: await must(clients[i].callApi('OwnedRoles', {})),
      learning: await must(clients[i].callApi('PetSkillLearning', {operation: 'QUERY'})),
    };
  }
  function nativeState() {
    const db = new DatabaseSync(database, {readOnly: true});
    try {
      return accounts.map(account => ({accountId: account.accountId,
        inventory: db.prepare('SELECT * FROM inventory WHERE account_id=? ORDER BY instance_id').all(account.accountId),
        owned: db.prepare('SELECT * FROM role_records WHERE account_id=? ORDER BY kind,instance_id').all(account.accountId),
        profile: db.prepare('SELECT * FROM role_profiles WHERE account_id=?').all(account.accountId),
        hotkeys: db.prepare('SELECT * FROM hotkeys WHERE account_id=? ORDER BY slot').all(account.accountId)}));
    } finally {db.close();}
  }
  try {
    await start();
    const unauthenticated = await clients[2].callApi('Channel', {operation: 'QUERY'});
    assert(!unauthenticated.isSucc); evidence.unauthenticated = unauthenticated;
    for (const [i, account] of accounts.entries()) await must(clients[i].callApi('Account', {token: account.token}));
    const before = await Promise.all([query(0), query(1)]), nativeBefore = nativeState();
    evidence.before = before;
    const registered = await must(clients[0].callApi('Account', {token: accounts[0].token,
      credentials: {operation: 'REGISTER', account: name, password}}));
    assert.equal(registered.accountId, accounts[0].accountId); assert.equal(registered.token, accounts[0].token);
    assert.equal(registered.accountName, name);
    evidence.registration = {accountId: registered.accountId, accountName: registered.accountName, existingIdentityRetained: true};
    const duplicate = await clients[2].callApi('Account', {credentials: {operation: 'REGISTER', account: name, password}});
    assert(!duplicate.isSucc); evidence.duplicate = duplicate;
    const wrong = await clients[2].callApi('Account', {credentials: {operation: 'LOGIN', account: name, password: '错误密码'}});
    assert(!wrong.isSucc); evidence.wrongPassword = wrong;
    const logged = await must(clients[2].callApi('Account', {credentials: {operation: 'LOGIN', account: name, password}}));
    assert.deepEqual(logged, registered); assert.deepEqual(await query(2), before[0]);
    const channels = await must(clients[2].callApi('Channel', {operation: 'QUERY'}));
    assert.equal(channels.channels.length, 1); assert.equal(channels.channels[0].id, 'main'); evidence.channels = channels;
    const rejected = await clients[2].callApi('Channel', {operation: 'ENTER', channelId: 'missing'});
    assert(!rejected.isSucc); evidence.rejectedChannel = rejected;
    const entered = await must(clients[2].callApi('Channel', {operation: 'ENTER', channelId: 'main'}));
    assert.equal(entered.enteredChannelId, 'main'); evidence.entered = entered;
    evidence.lobby = await must(clients[2].callApi('ListRooms', {}));
    const after = await Promise.all([query(0), query(1)]);
    assert.deepEqual(after, before); assert.deepEqual(nativeState(), nativeBefore);
    evidence.after = after; evidence.native = nativeBefore;
    await stop(); await start();
    const restored = await must(clients[0].callApi('Account', {credentials: {operation: 'LOGIN', account: name, password}}));
    assert.deepEqual(restored, registered);
    await must(clients[1].callApi('Account', {token: accounts[1].token}));
    const cold = await Promise.all([query(0), query(1)]); assert.deepEqual(cold, before);
    assert.deepEqual(nativeState(), nativeBefore); evidence.restored = cold; evidence.sameDatabaseRestart = true;
    const db = new DatabaseSync(database, {readOnly: true});
    try {
      assert.equal(db.prepare('SELECT count(*) AS n FROM account_credentials').get()!.n, 1);
      assert.equal(db.prepare('SELECT count(*) AS n FROM accounts').get()!.n, accounts.length);
    } finally {db.close();}
    evidence.status = 'PASS_FINITE_NAMED_LOGIN_BIND_EXISTING_IDENTITY_REJECTION_CHANNEL_ENTRY_NATIVE_SAME_DATABASE_RESTART_SCOPE';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); process.exitCode = 1;
  } finally {
    await stop();
    const db = new DatabaseSync(database);
    try {await backup(db, stem + '-checkpoint.sqlite');} finally {db.close();}
    chmodSync(stem + '-checkpoint.sqlite', 0o600);
    writeFileSync(stem + '-identity.private.json', JSON.stringify({...identity, login: {account: name, password}}, null, 2), {mode: 0o600});
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(stem + '.json', JSON.stringify(evidence, null, 2)); writeFileSync(stem + '.log', log);
    console.log(JSON.stringify({status: evidence.status, raw: stem + '.json'}));
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
