import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-history-network-'));
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1, 2].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3157',
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  clients.forEach((client, index) => client.listenMsg('RoomSnapshot', snapshot => {snapshots[index] = snapshot;}));
  async function wait(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 15000;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1500));
  }
  async function start(): Promise<void> {
    log = '';
    const environment: NodeJS.ProcessEnv = {...process.env, PORT: '3157', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')};
    delete environment.MATCH_MIN_PLAYERS; delete environment.MATCH_TIME_LIMIT_SECONDS;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env: environment,
      stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.includes('Server started'));
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
  }
  try {
    await start();
    const denied = await clients[0].callApi('History', {});
    assert(!denied.isSucc && denied.err.code === 'ACCOUNT_REQUIRED');
    const accounts = [];
    for (const client of clients) {
      const result = await client.callApi('Account', {}); assert(result.isSucc); accounts.push(result.res);
      const history = await client.callApi('History', {}); assert(history.isSucc && history.res.total === 0);
    }
    const host = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7, roomName: 'History', name: 'Owner', tankId: 1});
    assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id, name: 'Guest', tankId: 1, clientId: 'untrusted'});
    assert(guest.isSucc);
    for (const client of clients.slice(0, 2)) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0]?.phase === 'PLAYING' && snapshots[1]?.phase === 'PLAYING');
    await clients[1].disconnect(); // Real ordinary departure settles both identities.
    await wait(() => snapshots[0]?.phase === 'FINISHED');
    const frozen = snapshots[0]!.match!.result!;
    assert.equal(frozen.reason, 'FORFEIT');
    assert((await clients[1].connect()).isSucc);
    assert((await clients[1].callApi('Account', {token: accounts[1].token})).isSucc);
    const saved = [];
    for (let index = 0; index < 3; index++) {
      const history = await clients[index].callApi('History', {}); assert(history.isSucc);
      assert.equal(history.res.total, index < 2 ? 1 : 0);
      if (index < 2) {
        assert.deepEqual(history.res.records[0].result, frozen.players.find(player =>
          player.id === (index === 0 ? host.res.playerId : guest.res.playerId)));
        saved.push(history.res);
      }
    }
    for (const request of [{offset: -1}, {limit: 0}, {limit: 51}]) {
      const result = await clients[0].callApi('History', request);
      assert(!result.isSucc && result.err.code === 'HISTORY_REJECTED');
    }
    await stop(); await start();
    for (let index = 0; index < 3; index++) {
      assert((await clients[index].callApi('Account', {token: accounts[index].token})).isSucc);
      const history = await clients[index].callApi('History', {}); assert(history.isSucc);
      if (index < 2) assert.deepEqual(history.res, saved[index]);
      else assert.equal(history.res.total, 0);
    }
    // Room IDs restart, but globally distinct session IDs prevent key collisions.
    const second = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7, roomName: 'History', name: 'Owner', tankId: 1});
    assert(second.isSucc && second.res.room.id === host.res.room.id);
    assert((await clients[1].callApi('Join', {roomId: second.res.room.id, name: 'Guest', tankId: 1, clientId: ''})).isSucc);
    snapshots[0] = undefined;
    for (const client of clients.slice(0, 2)) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0]?.phase === 'PLAYING');
    await clients[1].disconnect(); await wait(() => snapshots[0]?.phase === 'FINISHED');
    const after = await clients[0].callApi('History', {limit: 1}); assert(after.isSucc);
    assert.equal(after.res.total, 2); assert.equal(after.res.records.length, 1);
    const page = await clients[0].callApi('History', {offset: 1, limit: 1}); assert(page.isSucc);
    assert.notEqual(page.res.records[0].matchId, after.res.records[0].matchId);
    writeFileSync('recovery/output/account-history-network.json', JSON.stringify({status: 'PASS',
      authenticatedClients: 3, unauthorizedRejected: true, invalidPaginationRejected: 3,
      bothDepartureIdentitiesSaved: true, frozenResult: frozen, restartRecovered: true,
      reusedRoomIdSeparated: true, actualPaging: [after.res, page.res], outsiderRecords: 0}, null, 2));
    console.log('PASS: true network settlement identities, disconnect loser save, private history, pagination, actual restart and reused-room IDs');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
