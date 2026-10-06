import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {roomInputLength, limitRoomInput} from '../apps/shared/room-input';

async function main() {
  assert.equal(roomInputLength('中😀A'), 3);
  assert.equal(limitRoomInput('中😀AB', 2), '中😀');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-room-input-'));
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3301', logger: undefined}));
  let server: ChildProcess | undefined, log = '';
  const rejected: string[] = [];
  try {
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: '3301', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', value => {log += value;});
    server.stderr!.on('data', value => {log += value;});
    const deadline = Date.now() + 15000;
    while (!log.includes('Server started') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(log.includes('Server started'), log);
    for (const client of clients) {assert((await client.connect()).isSucc); assert((await client.callApi('Account', {})).isSucc);}
    const request = {mode: 1, mapId: 7, roomName: '中😀'.repeat(4), password: '密😀'.repeat(10), name: 'Owner', tankId: 1};
    const before = await clients[0].callApi('ListRooms', {}); assert(before.isSucc);
    for (const values of [{roomName: request.roomName + 'A'}, {password: request.password + 'A'}, {password: 'bad\t'}]) {
      const result = await clients[0].callApi('CreateRoom', {...request, ...values});
      assert(!result.isSucc); rejected.push(result.err.message);
    }
    const after = await clients[0].callApi('ListRooms', {}); assert(after.isSucc); assert.deepEqual(after.res, before.res);
    const created = await clients[0].callApi('CreateRoom', request); assert(created.isSucc);
    assert(created.res.room.name.startsWith(request.roomName));
    const retry = await clients[0].callApi('CreateRoom', request); assert(retry.isSucc); assert.equal(retry.res.playerId, created.res.playerId);
    const joinRequest = {clientId: '', roomId: created.res.room.id, name: 'Guest', tankId: 1};
    for (const password of [request.password + 'A', 'wrong']) {
      const result = await clients[1].callApi('Join', {...joinRequest, password}); assert(!result.isSucc); rejected.push(result.err.message);
    }
    const joined = await clients[1].callApi('Join', {...joinRequest, password: request.password}); assert(joined.isSucc);
    assert.equal(joined.res.room.id, created.res.room.id);
    assert(!JSON.stringify([created.res, joined.res]).includes(request.password));
    for (const client of clients) assert((await client.callApi('Leave', {roomId: created.res.room.id, round: 1})).isSucc);
    writeFileSync('recovery/output/room-input-network.json', JSON.stringify({status: 'PASS', port: 3301,
      scope: 'Reconstructed server authority enforces recovered client codepoint limits; no original server claim',
      nameCodepoints: 8, passwordCodepoints: 20, nonBmpAccepted: true, rejected,
      rejectedCreationPreservesDirectory: true, retryReusesIdentity: true, correctPasswordJoin: true, noPlainPasswordInResponse: true}, null, 2) + '\n');
    console.log('PASS actual authenticated create/join Unicode boundaries, refusal without rooms, retry and password isolation');
  } finally {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;}
    rmSync(directory, {recursive: true, force: true});
    writeFileSync('recovery/output/room-input-network.log', log);
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
