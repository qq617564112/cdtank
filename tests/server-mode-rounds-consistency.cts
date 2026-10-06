import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createWriteStream, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {finished} from 'node:stream/promises';
import {createGzip} from 'node:zlib';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {ResListMaps} from '../apps/shared/protocols/PtlListMaps';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = resolve(`recovery/output/server-mode-rounds-consistency-${stamp}`);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-mode-rounds-'));
  const port = 3439;
  const files = [0, 1].map(index => `${prefix}-client${index}.jsonl.gz`);
  const outputs = files.map(file => createWriteStream(file));
  const streams = outputs.map(output => {const stream = createGzip(); stream.pipe(output); return stream;});
  const latest: (MsgRoomSnapshot | undefined)[] = [undefined, undefined];
  const peers: Map<number, MsgRoomSnapshot>[] = [new Map(), new Map()];
  const events: MsgRoomEvent[][] = [[], []];
  let compared = 0, comparisonError = '', active = false;
  const clients = [0, 1].map(index => {
    const client = new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`, logger: undefined,
      heartbeat: {interval: 5000, timeout: 10000}});
    client.listenMsg('RoomSnapshot', snapshot => {
      latest[index] = snapshot;
      streams[index].write(`${JSON.stringify({at: Date.now(), kind: 'snapshot', snapshot})}\n`);
      if (!active) return;
      const other = peers[1 - index].get(snapshot.tick);
      if (other) {
        try {assert.deepEqual(snapshot.players, other.players); assert.deepEqual(snapshot.match, other.match); compared++;}
        catch (error) {comparisonError ||= String(error);}
        peers[1 - index].delete(snapshot.tick);
      } else peers[index].set(snapshot.tick, snapshot);
    });
    client.listenMsg('RoomEvent', event => {
      events[index].push(event);
      streams[index].write(`${JSON.stringify({at: Date.now(), kind: 'event', event})}\n`);
    });
    return client;
  });
  let log = '';
  const environment: NodeJS.ProcessEnv = {...process.env, PORT: String(port), ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')};
  delete environment.MATCH_MIN_PLAYERS; delete environment.MATCH_TIME_LIMIT_SECONDS;
  const server = spawn(process.execPath, ['dist/server/server/src/index.js'], {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout.on('data', data => {log += String(data);}); server.stderr.on('data', data => {log += String(data);});
  const wait = async (condition: () => boolean, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) {
      assert(!comparisonError, comparisonError);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(condition(), log.slice(-600)); assert(!comparisonError, comparisonError);
  };
  const cases: Record<string, unknown>[] = [];
  const result: Record<string, unknown> = {status: 'RUNNING', port, files, cases,
    scope: 'M7-04 four missing modes, two ordinary emptyAccounts and two configuredCPUs, actual compiled service, original time/count/life rules, two natural rounds, frozen settlement, gatedRematch, History and Leave. No live-state or account imports.',
    reusedMode4: 'recovery/output/browser-account-autopilot-hd.json',
    fixture: 'Existing ordinary Cpu CONFIGURE temporary inventory only; no account profile/funds/roles/stock fixture.',
    limits: ['One representative map per missingmode', 'Rebuilt damage/CPU/modepolicies do not prove original authorities', 'Not HD performance or realtime tick stress benchmark']};
  let fatal: unknown;
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) {assert((await client.connect()).isSucc); assert((await client.callApi('Account', {})).isSucc);}
    const maps = await clients[0].callApi('ListMaps', {}); assert(maps.isSucc);
    const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
    const loadout = [2007, 2, 4, 6, 8].map((itemTableId, index) => {
      const item = catalog.items.find(value => value.itemTableId === itemTableId); assert(item);
      return {slot: index ? index + 4 : 2, itemTableId, quantity: Math.min(2, item.battleUseMax)};
    });
    for (const [mode, mapId] of [[1, 7], [2, 2], [3, 2], [5, 20]]) {
      const option: ResListMaps['maps'][number] | undefined = maps.res.maps.find(map => map.mode === mode && map.mapId === mapId); assert(option);
      const entry: Record<string, unknown> = {mode, mapId, sourceMap: option, status: 'RUNNING', rounds: []};
      cases.push(entry);
      const created = await clients[0].callApi('CreateRoom', {mode, mapId, roomName: '双局同步', name: '普通房主', tankId: 1}); assert(created.isSucc);
      const roomId = created.res.room.id;
      const joined = await clients[1].callApi('Join', {roomId, name: '普通同伴', tankId: 1, clientId: ''}); assert(joined.isSucc);
      const playerIds = [created.res.playerId, joined.res.playerId]; entry.playerIds = playerIds;
      for (let index = 0; index < 2; index++) {
        const cpu = await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1}); assert(cpu.isSucc);
        assert((await clients[0].callApi('Cpu', {round: 1, operation: 'CONFIGURE', playerId: cpu.res.playerId, loadout})).isSucc);
      }
      for (const client of clients) assert((await client.callApi('Autopilot', {round: 1, enabled: true})).isSucc);
      for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
      for (const round of [1, 2]) {
        active = false; peers.forEach(peer => peer.clear()); compared = 0; comparisonError = ''; events.forEach(values => {values.length = 0;});
        await wait(() => latest.every(snapshot => snapshot?.roomId === roomId && snapshot.phase === 'PLAYING' && snapshot.match?.round === round));
        const initial = structuredClone(latest[0]!); const startedAt = Date.now(); active = true;
        assert.equal(initial.players.length, 4); assert.equal(initial.remaining, option.timeLimit);
        assert(initial.players.every(player => player.alive && player.hp === player.maxHp && player.kills === 0 && player.deaths === 0));
        let nextProgress = Date.now() + 30000;
        const deadline = startedAt + (option.timeLimit + 20) * 1000;
        while (!latest.every(snapshot => snapshot?.phase === 'FINISHED')) {
          assert(Date.now() < deadline, 'Original time limit plus boundedsettlement window exceeded');
          assert(clients.every(client => client.isConnected)); assert(!comparisonError, comparisonError);
          await new Promise(resolve => setTimeout(resolve, 100));
          if (Date.now() >= nextProgress) {console.log(`mode${mode}/round${round} ${(Date.now() - startedAt) / 1000}s tick${latest[0]?.tick}`); nextProgress += 30000;}
        }
        await new Promise(resolve => setTimeout(resolve, 200)); active = false;
        const endedAt = Date.now(); assert(compared > 20); assert(!comparisonError, comparisonError);
        assert.deepEqual(latest[0]!.players, latest[1]!.players); assert.deepEqual(latest[0]!.match, latest[1]!.match);
        assert.deepEqual(events[0], events[1]); assert(events[0].some(event => event.type === 'fire'));
        const frozen = structuredClone(latest[0]!.match!.result); assert(frozen);
        const finishedSnapshots = structuredClone(latest);
        await new Promise(resolve => setTimeout(resolve, 1000));
        assert(latest.every(snapshot => snapshot?.phase === 'FINISHED')); assert.deepEqual(latest[0]!.match!.result, frozen);
        const histories = [];
        for (const [index, client] of clients.entries()) {
          const history = await client.callApi('History', {limit: 20}); assert(history.isSucc);
          const records = history.res.records.filter(record => record.round === round && record.mode === mode && record.mapId === mapId);
          assert.equal(records.length, 1); assert.deepEqual(records[0].result, frozen.players.find(player => player.id === playerIds[index]));
          histories.push(records[0]);
        }
        assert.equal(histories[0].matchId, histories[1].matchId);
        const summary = {round, initial, finishedSnapshots, observationWallMs: endedAt - startedAt, commonTicks: compared,
          eventCounts: Object.fromEntries([...new Set(events[0].map(event => event.type))].map(type => [type, events[0].filter(event => event.type === type).length])),
          eventPayloadOrderEqual: true, frozenOneSecond: true, histories};
        (entry.rounds as unknown[]).push(summary); writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2));
        console.log(`mode${mode}/round${round} NATURAL_${frozen.reason} commonTicks=${compared}`);
        if (round === 1) {
          assert((await clients[0].callApi('Rematch', {round})).isSucc);
          await new Promise(resolve => setTimeout(resolve, 300));
          assert(latest.every(snapshot => snapshot?.phase === 'FINISHED' && snapshot.match?.round === 1));
          entry.firstRematchVoteGated = true;
          assert((await clients[1].callApi('Rematch', {round})).isSucc);
          const stale = await clients[0].callApi('Rematch', {round}); assert(!stale.isSucc);
          entry.staleRoundRejected = stale.err.message;
        }
      }
      for (const client of [...clients].reverse()) assert((await client.callApi('Leave', {roomId, round: 2})).isSucc);
      const listed = await clients[0].callApi('ListRooms', {}); assert(listed.isSucc); assert(!listed.res.rooms.some(room => room.id === roomId));
      entry.roomRemoved = true; entry.status = 'PASS_TWO_NATURAL_REALTIME_ROUNDS';
      writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2));
    }
    result.status = 'PASS_FOUR_MISSING_MODES_TWO_NATURAL_REALTIME_ROUNDS';
  } catch (error) {fatal = error; result.status = 'FAIL'; result.error = String(error);}
  finally {
    active = false;
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill(); await stopped;}
    streams.forEach(stream => stream.end()); await Promise.all(outputs.map(output => finished(output)));
    rmSync(directory, {recursive: true, force: true}); result.cleaned = true;
    writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2)); writeFileSync(`${prefix}.log`, log);
  }
  console.log(`${result.status}: ${prefix}.json`); if (fatal) throw fatal;
}
void main();
