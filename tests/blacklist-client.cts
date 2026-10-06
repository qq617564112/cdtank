import assert from 'node:assert/strict';
import {Blacklist} from '../apps/web/src/network/blacklist';
import type {GameConnection} from '../apps/web/src/network/game-connection';

async function main() {
  const calls: {request: unknown; resolve: (result: unknown) => void}[] = [];
  const disconnected: ((input: unknown) => unknown)[] = [];
  const connection = {ensureConnected: async () => {}, client: {
    flows: {postDisconnectFlow: disconnected},
    callApi: (_name: string, request: unknown) => new Promise(resolve => calls.push({request, resolve})),
  }} as unknown as GameConnection;
  const blacklist = new Blacklist(connection);
  const record = {accountId: 'target', name: '朋友', online: true, inRoom: false};
  const initial = blacklist.refresh(); await Promise.resolve();
  const adding = blacklist.change('ADD', 'target'); await Promise.resolve();
  assert.equal(blacklist.getSnapshot().blocked.length, 0);
  await blacklist.change('REMOVE', 'target'); assert.equal(calls.length, 2);
  calls[1].resolve({isSucc: true, res: {blocked: [record]}}); await adding;
  calls[0].resolve({isSucc: true, res: {blocked: []}}); await initial;
  assert.deepEqual(blacklist.getSnapshot().blocked, [record], 'late list must not undo confirmed add');
  const rejection = blacklist.change('ADD', 'self'); await Promise.resolve();
  calls[2].resolve({isSucc: false, err: {message: '不能屏蔽自己'}}); await rejection;
  assert.deepEqual(blacklist.getSnapshot().blocked, [record]);
  assert.equal(blacklist.getSnapshot().status, '不能屏蔽自己');
  const deleting = blacklist.change('REMOVE', 'target'); await Promise.resolve();
  disconnected.forEach(flow => flow({}));
  calls[3].resolve({isSucc: true, res: {blocked: [record]}}); await deleting;
  assert.deepEqual(blacklist.getSnapshot(), {blocked: [], pending: false, status: '连接已断开'});
  const reconnect = blacklist.refresh(); await Promise.resolve();
  calls[4].resolve({isSucc: true, res: {blocked: [record]}}); await reconnect;
  assert.deepEqual(blacklist.getSnapshot().blocked, [record]);
  console.log('PASS late query, one mutation, rejection preservation, disconnect and authenticated refresh');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
