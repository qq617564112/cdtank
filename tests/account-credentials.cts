import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-login-'));
const path = join(directory, 'accounts.sqlite');
let store = new AccountStore(path);
try {
  const existing = store.open();
  store.setDisplayName(existing.accountId, '保存的坦克手');
  const before = store.inventory(existing.accountId);
  const bound = store.authenticate({token: existing.token,
    credentials: {operation: 'REGISTER', account: '坦克账号', password: '密码123'}});
  assert.equal(bound.accountId, existing.accountId);
  assert.equal(bound.token, existing.token);
  assert.equal(bound.accountName, '坦克账号');
  assert.deepEqual(store.inventory(bound.accountId), before);
  assert.equal(store.displayName(bound.accountId), '保存的坦克手');
  assert.throws(() => store.authenticate({credentials: {operation: 'LOGIN', account: '坦克账号', password: '错密码'}}), /账号或密码错误/);
  assert.throws(() => store.authenticate({credentials: {operation: 'REGISTER', account: '坦克账号', password: '别的密码'}}), /已注册/);
  assert.throws(() => store.authenticate({token: existing.token,
    credentials: {operation: 'REGISTER', account: '别名', password: '123'}}), /已绑定/);
  assert.throws(() => store.authenticate({token: 'invalid',
    credentials: {operation: 'REGISTER', account: '无效身份', password: '123'}}), /凭据无效/);
  assert.throws(() => store.authenticate({credentials: {operation: 'REGISTER', account: 'x'.repeat(21), password: '123'}}), /1至20/);
  const independent = store.authenticate({credentials: {operation: 'REGISTER', account: '第二账号', password: '123'}});
  assert.notEqual(independent.accountId, bound.accountId);
  store.close();
  store = new AccountStore(path);
  assert.deepEqual(store.authenticate({credentials: {operation: 'LOGIN', account: '坦克账号', password: '密码123'}}), bound);
  assert.deepEqual(store.authenticate({token: existing.token}), bound);
  assert.equal(store.displayName(bound.accountId), '保存的坦克手');
  assert.deepEqual(store.inventory(bound.accountId), before);
  const database = new DatabaseSync(path);
  assert.equal(database.prepare('SELECT count(*) AS n FROM accounts').get()!.n, 2);
  assert.equal(database.prepare('SELECT count(*) AS n FROM account_credentials').get()!.n, 2);
  database.close();
  console.log('PASS_ACCOUNT_CREDENTIAL_BINDING_REJECTION_ISOLATION_REOPEN');
} finally {
  store.close();
  rmSync(directory, {recursive: true, force: true});
}
