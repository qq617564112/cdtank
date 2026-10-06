import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

type Frame = {receivedAt: number; snapshot: MsgRoomSnapshot};
type Case = {key: string; startedAt: number; endedAt: number; status: string;
  error?: string; evidence: string; world?: {samples: number; maximumMs: number; p95Ms: number}};

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = resolve(`recovery/output/server-source-max-map-matrix-${stamp}`);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-max-matrix-'));
  const port = 3437;
  const frames: Frame[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  const clients = [0, 1].map(index => {
    const client = new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`, logger: undefined,
      heartbeat: {interval: 5000, timeout: 10000}});
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({receivedAt: Date.now(), snapshot});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
    return client;
  });
  let log = '';
  const environment: NodeJS.ProcessEnv = {...process.env, PORT: String(port),
    ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'), CDTANK_TICK_PROFILE_STEPS: `${prefix}-steps.json`};
  delete environment.MATCH_MIN_PLAYERS;
  delete environment.MATCH_TIME_LIMIT_SECONDS;
  const server = spawn(process.execPath, ['tests/server-complex-map-profile-entry.mjs'],
    {env: environment, stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const wait = async (condition: () => boolean, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), log.slice(-600));
  };
  const cases: Case[] = [];
  const result: Record<string, unknown> = {status: 'RUNNING', port, cases,
    scope: 'M7-03 remaining25 source mode/map combinations at maximum players: two normal empty Accounts plus managed CPUs, sequential compiled service. Original rules, observe60s or natural finish.',
    reused: 'recovery/output/complex-map-max-players-accepted.json',
    thresholds: {worldStepMs: 50, maximumServerSnapshotGapMs: 150},
    fixture: 'No imported account profile/funds/roles/stock. Existing ordinary CPU CONFIGURE temporary stock policy.',
    limitations: ['Two network clients; maximum-human fanout unverified', 'Natural early finishes do not establish60-second sustained load', 'Configured loadout does not cover every skill']};
  let fatal: unknown;
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {})).isSucc);
    }
    const maps = await clients[0].callApi('ListMaps', {}); assert(maps.isSucc);
    assert.equal(maps.res.maps.length, 26);
    const selected = maps.res.maps.filter(map => !(map.mode === 5 && map.mapId === 20));
    assert.equal(selected.length, 25); result.sourceMaps = maps.res.maps;
    const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
    const loadout = [2007, 2, 4, 6, 8].map((itemTableId, index) => {
      const item = catalog.items.find(value => value.itemTableId === itemTableId); assert(item);
      return {slot: index ? index + 4 : 2, itemTableId, quantity: Math.min(2, item.battleUseMax)};
    });
    result.cpuLoadout = loadout;
    for (const map of selected) {
      frames.forEach(values => {values.length = 0;}); events.forEach(values => {values.length = 0;});
      const key = `${map.mode}-${map.mapId}`;
      const entry: Case = {key, startedAt: 0, endedAt: 0, status: 'RUNNING', evidence: `${prefix}-${key}.json`};
      cases.push(entry);
      const raw: Record<string, unknown> = {sourceMap: map, loadout};
      let roomId: string | undefined;
      try {
        const created = await clients[0].callApi('CreateRoom', {mode: map.mode, mapId: map.mapId,
          roomName: '源满员验', name: '普通房主', tankId: 1});
        assert(created.isSucc, created.isSucc ? undefined : created.err.message); roomId = created.res.room.id;
        assert((await clients[1].callApi('Join', {roomId, name: '普通同伴', tankId: 1, clientId: ''})).isSucc);
        for (let index = 0; index < map.maxPlayers - 2; index++) {
          const cpu = await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1}); assert(cpu.isSucc);
          assert((await clients[0].callApi('Cpu', {round: 1, operation: 'CONFIGURE', playerId: cpu.res.playerId, loadout})).isSucc);
        }
        await wait(() => frames.every(values => values.at(-1)?.snapshot.players.length === map.maxPlayers));
        for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
        await wait(() => frames.every(values => values.at(-1)?.snapshot.phase === 'PLAYING'));
        for (const client of clients) assert((await client.callApi('Autopilot', {round: 1, enabled: true})).isSucc);
        entry.startedAt = Date.now();
        while (Date.now() - entry.startedAt < 60000) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          assert(clients.every(client => client.isConnected));
          if (frames.every(values => values.at(-1)?.snapshot.phase === 'FINISHED')) break;
        }
        entry.endedAt = Date.now(); raw.observationWallMs = entry.endedAt - entry.startedAt;
        raw.finalPhase = frames.map(values => values.at(-1)?.snapshot.phase);
        const measured = frames.map(values => values.filter(value => value.snapshot.serverTime >= entry.startedAt));
        const gaps = measured.map(values => values.slice(1).map((value, index) => ({
          serverMs: value.snapshot.serverTime - values[index].snapshot.serverTime,
          wallMs: value.receivedAt - values[index].receivedAt})));
        raw.maximumGaps = gaps.map(values => ({serverMs: Math.max(...values.map(value => value.serverMs)),
          wallMs: Math.max(...values.map(value => value.wallMs))}));
        const peer = new Map(measured[1].map(value => [value.snapshot.tick, value.snapshot]));
        let common = 0;
        for (const {snapshot} of measured[0]) {
          const other = peer.get(snapshot.tick); if (!other) continue;
          assert.deepEqual(snapshot.players, other.players); assert.deepEqual(snapshot.match, other.match);
          assert.equal(snapshot.players.length, map.maxPlayers); common++;
        }
        assert(common >= 20); raw.commonTicks = common;
        raw.eventCounts = events.map(values => Object.fromEntries([...new Set(values.map(value => value.type))]
          .map(type => [type, values.filter(value => value.type === type).length])));
        assert(events[0].some(value => value.type === 'fire'));
        assert(gaps.every(values => values.every(value => value.serverMs <= 150)), 'Server snapshot gap exceeds150ms');
        entry.status = 'PASS_NETWORK_SCOPE_PENDING_WORLD_TIMING';
      } catch (error) {entry.status = 'FAIL'; entry.error = String(error);}
      finally {
        if (roomId) {
          for (const client of [clients[1], clients[0]]) {
            const left = await client.callApi('Leave', {roomId, round: 1});
            if (!left.isSucc) {entry.status = 'FAIL'; entry.error = `Leave: ${left.err.message}`;}
          }
          const listed = await clients[0].callApi('ListRooms', {});
          raw.roomRemoved = listed.isSucc && !listed.res.rooms.some(room => room.id === roomId);
          if (!raw.roomRemoved) {entry.status = 'FAIL'; entry.error = 'Room remained after Leave';}
        }
        raw.frames = frames; raw.events = events; raw.summary = entry;
        writeFileSync(entry.evidence, JSON.stringify(raw, null, 2));
        console.log(`${cases.length}/25 ${key} ${entry.status} observed=${entry.endedAt - entry.startedAt}ms`);
        writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2));
      }
    }
  } catch (error) {fatal = error; result.error = String(error);}
  finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill(); await stopped;}
    try {
      const steps = JSON.parse(readFileSync(`${prefix}-steps.json`, 'utf8')) as {steps: {wallAt: number; duration: number}[]};
      for (const entry of cases) {
        const times = steps.steps.filter(step => step.wallAt >= entry.startedAt && step.wallAt <= entry.endedAt)
          .map(step => step.duration).sort((a, b) => a - b);
        entry.world = {samples: times.length, maximumMs: Math.max(...times), p95Ms: times[Math.floor(times.length * .95)]};
        if (entry.status !== 'FAIL') {
          if (!times.length || entry.world.maximumMs > 50) {entry.status = 'FAIL'; entry.error = 'World step exceeds50ms or missing samples';}
          else entry.status = 'PASS_SOURCE_MAX_MAP_OBSERVED_SCOPE';
        }
        const raw = JSON.parse(readFileSync(entry.evidence, 'utf8')); raw.summary = entry;
        writeFileSync(entry.evidence, JSON.stringify(raw, null, 2));
      }
    } catch (error) {fatal ??= error; result.error = String(error);}
    result.status = !fatal && cases.length === 25 && cases.every(entry => entry.status === 'PASS_SOURCE_MAX_MAP_OBSERVED_SCOPE')
      ? 'PASS_REMAINING25_SOURCE_MAX_MAP_OBSERVED_SCOPE' : 'FAIL';
    result.cleaned = true; writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2));
    writeFileSync(`${prefix}.log`, log); rmSync(directory, {recursive: true, force: true});
  }
  console.log(`${result.status}: ${prefix}.json`);
  if (result.status === 'FAIL') throw fatal ?? new Error('See matrix case failures');
}
void main();
