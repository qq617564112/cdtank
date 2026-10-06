import assert from 'node:assert/strict';
import {Friends} from '../apps/web/src/network/friends';
import type {GameConnection} from '../apps/web/src/network/game-connection';

async function main() {
  const calls: {request: unknown; resolve: (result: unknown) => void}[] = [];
  const disconnected: ((input: unknown) => unknown)[] = [];
  const connection = {ensureConnected: async () => {}, client: {
    flows: {postDisconnectFlow: disconnected},
    callApi: (_name: string, request: unknown) => new Promise(resolve => calls.push({request, resolve})),
  }} as unknown as GameConnection;
  const friends = new Friends(connection);
  const record = {accountId: 'target', name: '朋友', online: true, inRoom: false};
  const initial = friends.refresh(); await Promise.resolve();
  const adding = friends.change('ADD', 'target'); await Promise.resolve();
  assert.equal(friends.getSnapshot().friends.length, 0);
  await friends.change('REMOVE', 'target'); assert.equal(calls.length, 2);
  calls[1].resolve({isSucc: true, res: {friends: [record]}}); await adding;
  calls[0].resolve({isSucc: true, res: {friends: []}}); await initial;
  assert.deepEqual(friends.getSnapshot().friends, [record], 'late list must not undo confirmed add');
  const rejection = friends.change('ADD', 'self'); await Promise.resolve();
  calls[2].resolve({isSucc: false, err: {message: '不能添加自己'}}); await rejection;
  assert.deepEqual(friends.getSnapshot().friends, [record]);
  assert.equal(friends.getSnapshot().status, '不能添加自己');
  const deleting = friends.change('REMOVE', 'target'); await Promise.resolve();
  disconnected.forEach(flow => flow({}));
  calls[3].resolve({isSucc: true, res: {friends: [record]}}); await deleting;
  assert.deepEqual(friends.getSnapshot(), {friends: [], pending: false, status: '连接已断开'});
  const reconnect = friends.refresh(); await Promise.resolve();
  calls[4].resolve({isSucc: true, res: {friends: [record]}}); await reconnect;
  assert.deepEqual(friends.getSnapshot().friends, [record]);
  console.log('PASS late query, one mutation, rejection preservation, disconnect and authenticated refresh');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
