import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const humanFanout = process.argv.includes('--human-fanout');
  const prefix = resolve(`recovery/output/server-complex-map-${humanFanout ? 'human-fanout' : 'max-players'}-${stamp}`);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-complex-map-'));
  const port = humanFanout ? 3438 : 3436;
  const humanCount = humanFanout ? 12 : 2;
  const profiling = process.argv.includes('--profile');
  const compiled = process.argv.includes('--compiled');
  const frames: {receivedAt: number; snapshot: MsgRoomSnapshot}[][] = Array.from({length: humanCount}, () => []);
  const events: MsgRoomEvent[][] = Array.from({length: humanCount}, () => []);
  const clients = Array.from({length: humanCount}, (_, index) => {
    const client = new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`, logger: undefined,
      heartbeat: {interval: 5000, timeout: 10000}});
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({receivedAt: Date.now(), snapshot});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
    return client;
  });
  let log = '';
  const environment: NodeJS.ProcessEnv = {...process.env, PORT: String(port), ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'),
    CDTANK_TICK_PROFILE_STEPS: `${prefix}-steps.json`};
  delete environment.MATCH_MIN_PLAYERS;
  delete environment.MATCH_TIME_LIMIT_SECONDS;
  const server = spawn(process.execPath, [...(profiling ? ['--cpu-prof', '--cpu-prof-dir=recovery/output', `--cpu-prof-name=server-complex-map-max-players-${stamp}.cpuprofile`] : []), ...(compiled ? ['tests/server-complex-map-profile-entry.mjs'] : ['--import', 'tsx', 'tests/server-tick-profile-entry.cts'])], {
    env: environment, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const wait = async (condition: () => boolean, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), log.slice(-600));
  };
  const result: Record<string, unknown> = {status: 'RUNNING', port,
    scope: humanFanout
      ? 'M7-03 source-max12 mode5/map20 twelve ordinary empty Account connections, default2001 and ordinary Autopilot. No CPUs, account import, loadout import, live-state injection or rule overrides.'
      : 'M7-03 one source-max12 mode5/map20 room; normal empty Account default roles, two humans and ten managed CPUs, ordinary configured temporary CPU stock and Autopilot. No live-state injection or rule overrides.',
    humanFanout, humanCount, profiling, compiled, thresholds: {tickTargetMs: 50, maximumSnapshotGapMs: 150},
    fixture: humanFanout ? 'No imported profile, funds, roles or inventory. Twelve Account-created users use ordinary default2001; no CPU configuration.'
      : 'No imported profile, funds, roles or account inventory. CPU CONFIGURE uses existing explicitly rebuilt temporary stock policy.'};
  let error: unknown;
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {})).isSucc);
    }
    const maps = await clients[0].callApi('ListMaps', {}); assert(maps.isSucc);
    const option = maps.res.maps.find(map => map.mode === 5 && map.mapId === 20);
    assert(option); assert.equal(option.maxPlayers, 12); assert.equal(option.timeLimit, 180);
    result.sourceMap = option;
    const created = await clients[0].callApi('CreateRoom', {mode: 5, mapId: 20,
      roomName: '十二人节拍', name: '普通房主', tankId: 1}); assert(created.isSucc, created.isSucc ? undefined : created.err.message);
    const roomId = created.res.room.id;
    for (const [index, client] of clients.slice(1).entries()) {
      assert((await client.callApi('Join', {roomId, name: `普通同伴${index + 1}`, tankId: 1, clientId: ''})).isSucc);
    }
    const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
    const loadout = [2007, 2, 4, 6, 8].map((itemTableId, index) => {
      const item = catalog.items.find(value => value.itemTableId === itemTableId); assert(item);
      return {slot: index ? index + 4 : 2, itemTableId, quantity: Math.min(2, item.battleUseMax)};
    });
    result.cpuLoadout = humanFanout ? [] : loadout;
    const cpuIds: string[] = [];
    for (let index = 0; index < 12 - humanCount; index++) {
      const cpu = await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1}); assert(cpu.isSucc);
      cpuIds.push(cpu.res.playerId);
      assert((await clients[0].callApi('Cpu', {round: 1, operation: 'CONFIGURE', playerId: cpu.res.playerId, loadout})).isSucc);
    }
    result.cpuIds = cpuIds;
    await wait(() => frames.every(values => values.at(-1)?.snapshot.players.length === 12));
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(values => values.at(-1)?.snapshot.phase === 'PLAYING'));
    for (const client of clients) assert((await client.callApi('Autopilot', {round: 1, enabled: true})).isSucc);
    const start = Date.now(); result.observationStartedAt = start;
    for (let elapsed = 0; elapsed < 60; elapsed++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      assert(clients.every(client => client.isConnected));
      assert(frames.every(values => values.at(-1)?.snapshot.phase === 'PLAYING'), 'Match finished before60-second load scope');
      if ((elapsed + 1) % 15 === 0) console.log(`complex-map ${elapsed + 1}/60 seconds`);
    }
    result.observationWallMs = Date.now() - start;
    const measured = frames.map(values => values.filter(value => value.snapshot.serverTime >= start));
    const gaps = measured.map(values => values.slice(1).map((value, index) => ({
      serverMs: value.snapshot.serverTime - values[index].snapshot.serverTime,
      wallMs: value.receivedAt - values[index].receivedAt,
    })));
    result.maximumGaps = gaps.map(values => ({serverMs: Math.max(...values.map(value => value.serverMs)),
      wallMs: Math.max(...values.map(value => value.wallMs))}));
    result.gaps = gaps;
    const peers = measured.slice(1).map(values => new Map(values.map(value => [value.snapshot.tick, value.snapshot])));
    const commonTicks = peers.map(() => 0);
    for (const {snapshot} of measured[0]) {
      assert.equal(snapshot.players.length, 12);
      for (const [index, peer] of peers.entries()) {
        const other = peer.get(snapshot.tick); if (!other) continue;
        assert.deepEqual(snapshot.players, other.players);
        assert.deepEqual(snapshot.match, other.match); commonTicks[index]++;
      }
    }
    assert(commonTicks.every(count => count > 500));
    result.commonTicks = Math.min(...commonTicks); result.perClientCommonTicks = commonTicks;
    result.eventCounts = events.map(values => Object.fromEntries([...new Set(values.map(value => value.type))]
      .map(type => [type, values.filter(value => value.type === type).length])));
    assert(events[0].some(value => value.type === 'hit'));
    if (!humanFanout) assert(events[0].some(value => value.type === 'itemUsed'));
    else {
      for (const values of events) assert.deepEqual(values, events[0]);
      assert(events.every(values => values.some(value => value.type === 'fire') && values.some(value => value.type === 'hit')));
      assert(frames[0].at(-1)?.snapshot.players.every(player => !player.isCpu && player.isAutopilot));
    }
    for (const client of [...clients].reverse()) assert((await client.callApi('Leave', {roomId, round: 1})).isSucc);
    const listed = await clients[0].callApi('ListRooms', {}); assert(listed.isSucc);
    assert(!listed.res.rooms.some(room => room.id === roomId)); result.roomRemoved = true;
    assert(gaps.every(values => values.every(value => value.serverMs <= 150)), 'Server snapshot gap exceeds150ms');
    result.status = profiling ? 'MEASURED_COMPLEX_MAP_CPU_PROFILE_ONLY' : humanFanout ? 'PASS_SOURCE_MAX12_HUMAN_FANOUT_TIMING_SCOPE' : 'PASS_SOURCE_MAX12_COMPLEX_MAP_TIMING_SCOPE';
  } catch (caught) {error = caught; result.status = 'FAIL'; result.error = String(caught);}
  finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const stopped = new Promise(resolve => server.once('exit', resolve)); server.kill(); await stopped;
    }
    try {
      const steps = JSON.parse(readFileSync(`${prefix}-steps.json`, 'utf8'));
      result.steps = steps;
      result.worldMaximumMs = Math.max(...steps.steps.map((step: {duration: number}) => step.duration));
      if (!profiling && ['PASS_SOURCE_MAX12_COMPLEX_MAP_TIMING_SCOPE', 'PASS_SOURCE_MAX12_HUMAN_FANOUT_TIMING_SCOPE'].includes(String(result.status)) && Number(result.worldMaximumMs) > 50) {
        error = new Error(`World step ${result.worldMaximumMs}ms exceeds50ms target`);
        result.status = 'FAIL'; result.error = String(error);
      }
    } catch (caught) {error ??= caught; result.status = 'FAIL'; result.error = String(error);}
    result.events = events;
    writeFileSync(`${prefix}.log`, log);
    try {
      if (humanFanout) {
        // Twelve full streams exceed V8's single-string limit; preserve each peer separately.
        const frameFiles = frames.map((_, index) => `${prefix}-client${index}.json`);
        for (const [index, file] of frameFiles.entries()) {
          writeFileSync(file, JSON.stringify(frames[index]));
          frames[index].length = 0;
        }
        result.frameFiles = frameFiles;
      } else result.frames = frames;
      result.cleaned = true;
      writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2));
    } finally {rmSync(directory, {recursive: true, force: true});}
  }
  console.log(`${result.status}: ${prefix}.json`);
  if (error) throw error;
}
void main();
