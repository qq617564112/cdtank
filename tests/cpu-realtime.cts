import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import {getMapConfig} from '../apps/server/src/config';

const port = 3117, mapId = Number(process.argv[2] ?? 4);
const durationMs = Number(process.argv[3] ?? 30000);
const mode = Number(process.argv[4] ?? 1);
const cpuCount = Number(process.argv[5] ?? 3);
const requireObjective = process.argv.includes('--require-objective');
const twoRounds = process.argv.includes('--two-rounds');
assert(Number.isInteger(cpuCount) && cpuCount > 0);
assert(!requireObjective || durationMs === 0, 'Objective acceptance requires a complete match (duration0)');
assert(!twoRounds || durationMs === 0, 'Two-round acceptance requires complete natural matches');
const env: NodeJS.ProcessEnv = {...process.env, PORT: String(port), TICK_RATE: '20'};
delete env.MATCH_TIME_LIMIT_SECONDS; delete env.MATCH_MIN_PLAYERS;
const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'],
  {env, stdio: ['ignore', 'pipe', 'pipe']});
let log = '';
server.stdout.on('data', chunk => {log += String(chunk);});
server.stderr.on('data', chunk => {log += String(chunk);});
const clients = Array.from({length: 2}, () => new WsClient(serviceProto, {
  server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000},
}));
const records: Array<Array<{receivedAt: number; state: MsgRoomSnapshot}>> = [[], []];
const events: MsgRoomEvent[][] = [[], []];
clients.forEach((client, index) => {
  client.listenMsg('RoomSnapshot', state => {records[index].push({receivedAt: performance.now(), state});});
  client.listenMsg('RoomEvent', event => {events[index].push(event);});
});
async function waitUntil(condition: () => boolean, timeoutMs = 10000): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!condition()) {
    if (performance.now() >= deadline) throw new Error('Real-time CPU condition timeout\n' + log.slice(-4000));
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
const latest = (index: number) => records[index].at(-1)?.state;
async function main(): Promise<void> {
try {
  await waitUntil(() => log.includes(`Server started at ${port}.`));
  for (const client of clients) assert((await client.connect()).isSucc);
  const created = await clients[0].callApi('CreateRoom', {mode, mapId,
    roomName: 'Real-time CPU', name: 'Observer', tankId: 1});
  assert(created.isSucc, created.isSucc ? '' : created.err.message);
  for (let index = 0; index < cpuCount; index++) {
    const tankId = index % 3 === 1 ? 105 : 1;
    assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId})).isSucc);
  }
  const guest = await clients[1].callApi('Join', {roomId: created.res.room.id, name: 'Remote observer', tankId: 1, clientId: ''});
  assert(guest.isSucc);
  const eventStarts = events.map(list => list.length);
  assert((await clients[1].callApi('Ready', {round: 1})).isSucc);
  assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
  await waitUntil(() => latest(0)?.phase === 'PLAYING' && latest(1)?.phase === 'PLAYING');
  const started = performance.now();
  const startTick = latest(0)!.tick;
  console.log(`Real-time CPU map ${mapId}: ${durationMs === 0 ? 'complete autonomous match' : `autonomous observation ${durationMs}ms`}`);
  if (durationMs === 0) {
    let nextProgress = started + 30000;
    await waitUntil(() => {
      const state = latest(0)!;
      if (performance.now() >= nextProgress) {
        nextProgress = performance.now() + 30000;
        console.log(JSON.stringify({mapId, phase: state.phase, remainingSeconds: state.remaining,
          clearedObjectives: state.match!.objectives.filter(objective => objective.hp === 0).length,
          totalObjectives: state.match!.objectives.length,
          cpuKills: state.players.filter(player => player.isCpu).reduce((sum, player) => sum + player.kills, 0)}));
      }
      return state.phase === 'FINISHED' && latest(1)?.phase === 'FINISHED';
    },
      latest(0)!.remaining * 1000 + 60000);
  } else await new Promise(resolve => setTimeout(resolve, durationMs));
  const ended = performance.now();
  const measured = records.map(list => list.filter(row => row.receivedAt >= started && row.receivedAt <= ended
    && (durationMs !== 0 || row.state.phase === 'PLAYING')));
  assert(measured.every(rows => rows.length > 10));
  const peer = new Map(measured[1].map(row => [row.state.tick, row]));
  let matchedTicks = 0, maxPeerArrivalSkewMs = 0;
  for (const row of measured[0]) {
    const other = peer.get(row.state.tick);
    if (!other) continue;
    assert.deepEqual(row.state, other.state, 'Both independent connections must receive identical authoritative state at the same tick');
    matchedTicks++; maxPeerArrivalSkewMs = Math.max(maxPeerArrivalSkewMs, Math.abs(row.receivedAt - other.receivedAt));
  }
  assert(matchedTicks > 10);
  const cpuIds = latest(0)!.players.filter(player => player.isCpu).map(player => player.id);
  assert.equal(cpuIds.length, cpuCount);
  const combatEvents = () => events.map((list, index) => list.slice(eventStarts[index]));
  assert(combatEvents()[0].filter(event => event.type === 'fire').every(event => cpuIds.includes(event.playerId)),
    'All combat firing must come from ordinary CPU inputs while humans observe');
  assert(events[0].some(event => event.type === 'fire' && cpuIds.includes(event.playerId)), 'CPUs must actually fight');
  const isHit = (event: MsgRoomEvent) => event.type === 'hit' || event.type === 'objectiveHit';
  assert(events[0].some(event => isHit(event) && cpuIds.includes(event.playerId)),
    'Natural CPU projectiles must hit a player or objective');
  const frames = measured.map(rows => {
    const intervals = rows.slice(1).map((row, index) => row.receivedAt - rows[index].receivedAt).sort((a, b) => a - b);
    const tickGaps = rows.slice(1).map((row, index) => row.state.tick - rows[index].state.tick);
    assert(tickGaps.every(gap => gap === 1), 'No missing/out-of-order authoritative snapshots during measurement');
    return {snapshotCount: rows.length, p50Ms: intervals[Math.floor(intervals.length * .5)],
      p95Ms: intervals[Math.floor(intervals.length * .95)], maxMs: intervals.at(-1),
      observedTicksPerSecond: (rows.at(-1)!.state.tick - rows[0].state.tick) / ((rows.at(-1)!.receivedAt - rows[0].receivedAt) / 1000)};
  });
  const final = latest(0)!;
  let roundCombatEvents = combatEvents()[0];
  let fullMatchLifecycle = false;
  let matchedCombatEvents: number | undefined;
  let secondRound: object | undefined;
  if (durationMs === 0) {
    assert.equal(final.phase, 'FINISHED');
    assert.deepEqual(final.match!.result, latest(1)!.match!.result);
    const frozen = structuredClone(final.match!.result);
    const frozenSnapshotCount = records[0].length;
    await waitUntil(() => records[0].length >= frozenSnapshotCount + 5);
    assert.deepEqual(latest(0)!.match!.result, frozen, 'Finished result must remain frozen');
    const roundEvents = combatEvents();
    assert.deepEqual(roundEvents[0], roundEvents[1],
      'Both clients must receive the same ordered round events, including fire, damage, death and settlement');
    roundCombatEvents = roundEvents[0];
    matchedCombatEvents = roundEvents[0].length;
    assert((await clients[0].callApi('Rematch', {round: 1})).isSucc);
    await waitUntil(() => latest(0)!.match!.rematchPlayerIds.length === cpuCount + 1);
    assert.equal(latest(0)!.phase, 'FINISHED', 'CPU votes must still wait for the second human');
    const secondEventStarts = events.map(list => list.length);
    assert((await clients[1].callApi('Rematch', {round: 1})).isSucc);
    await waitUntil(() => latest(0)?.phase === 'PLAYING' && latest(1)?.match?.round === 2);
    assert(latest(0)!.players.every(player => player.alive && player.hp === player.maxHp
      && player.kills === 0 && player.objectivesDestroyed === 0));
    if (twoRounds) {
      const secondStarted = performance.now();
      const initial = structuredClone(latest(0)!);
      assert.equal(initial.remaining, getMapConfig(mode, mapId).timeLimit);
      assert.deepEqual(initial.players.map(player => [player.id, player.maxHp]),
        final.players.map(player => [player.id, player.maxHp]), 'Rematch preserves normal maximum HP');
      let nextProgress = secondStarted + 30000;
      await waitUntil(() => {
        const state = latest(0)!;
        if (performance.now() >= nextProgress) {
          nextProgress = performance.now() + 30000;
          console.log(JSON.stringify({round: 2, mapId, phase: state.phase, remaining: state.remaining,
            cleared: state.match!.objectives.filter(objective => objective.hp === 0).length}));
        }
        return state.phase === 'FINISHED' && latest(1)?.phase === 'FINISHED';
      }, initial.remaining * 1000 + 60000);
      const secondEnded = performance.now();
      const result = structuredClone(latest(0)!);
      assert.equal(result.match!.round, 2);
      assert.deepEqual(result.match!.result, latest(1)!.match!.result);
      const frozenCount = records[0].length;
      await waitUntil(() => records[0].length >= frozenCount + 5);
      assert.deepEqual(latest(0)!.match!.result, result.match!.result);
      const roundEvents = events.map((list, index) => list.slice(secondEventStarts[index]));
      assert.deepEqual(roundEvents[0], roundEvents[1], 'Second-round ordered events must match');
      const firing = roundEvents[0].filter(event => event.type === 'fire');
      const hits = roundEvents[0].filter(isHit);
      assert(firing.length > 0 && hits.length > 0, 'Second round must contain natural CPU fire and hits');
      assert(firing.every(event => cpuIds.includes(event.playerId)), 'Humans do not inject combat input');
      const rows = records.map(list => list.filter(row => row.receivedAt >= secondStarted
        && row.receivedAt <= secondEnded && row.state.match?.round === 2 && row.state.phase === 'PLAYING'));
      const remote = new Map(rows[1].map(row => [row.state.tick, row.state]));
      let matched = 0;
      for (const row of rows[0]) {
        const other = remote.get(row.state.tick);
        if (other) {assert.deepEqual(row.state, other); matched++;}
      }
      assert(matched > 10);
      for (const list of rows) assert(list.slice(1).every((row, index) => row.state.tick === list[index].state.tick + 1));
      if (requireObjective) {
        assert.equal(result.match!.result!.reason, 'OBJECTIVE');
        if (mode === 5) assert(result.match!.objectives.every(objective => objective.hp === 0));
      }
      secondRound = {status: 'PASS', elapsedMs: secondEnded - secondStarted, initial, final: result,
        matchedTicks: matched, matchedCombatEvents: roundEvents[0].length, fire: firing.length,
        hit: hits.length, frozenResult: true};
      console.log(JSON.stringify({round: 2, status: 'PASS', elapsedMs: secondEnded - secondStarted,
        reason: result.match!.result!.reason, matchedTicks: matched, fire: firing.length, hit: hits.length}));
    }
    fullMatchLifecycle = true;
  }
  await clients[1].disconnect();
  await waitUntil(() => latest(0)?.players.length === cpuCount + 1 && !latest(0)?.players.some(player => player.id === guest.res.playerId));
  assert.equal(latest(0)!.players.filter(player => player.isCpu).length, cpuCount);
  await clients[0].disconnect();
  assert((await clients[0].connect()).isSucc);
  let removed = false;
  const cleanupDeadline = performance.now() + 3000;
  while (!removed && performance.now() < cleanupDeadline) {
    const rooms = await clients[0].callApi('ListRooms', {});
    assert(rooms.isSucc); removed = !rooms.res.rooms.some(room => room.id === created.res.room.id);
    if (!removed) await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert(removed, 'Last human disconnect must remove the CPU room');
  const cpuCombat = final.players.filter(player => player.isCpu).map(player => ({
    playerId: player.id, tankId: player.tankId, team: player.team,
    fire: roundCombatEvents.filter(event => event.type === 'fire' && event.playerId === player.id).length,
    hit: roundCombatEvents.filter(event => isHit(event) && event.playerId === player.id).length,
    kills: player.kills, deaths: player.deaths, objectivesDestroyed: player.objectivesDestroyed ?? 0,
  }));
  const objectiveVictory = final.match?.result?.reason === 'OBJECTIVE';
  const allDestroyTargetsCleared = mode !== 5 || (final.match!.objectives.length > 0
    && final.match!.objectives.every(objective => objective.hp === 0));
  const acceptancePassed = !requireObjective || (objectiveVictory && allDestroyTargetsCleared);
  const evidence = {status: acceptancePassed ? 'PASS' : 'FAIL', requireObjective, objectiveVictory,
    allDestroyTargetsCleared, scope: `Two actual TSRPC connections, independent new server, real clock20Hz/original map capacity/time,${cpuCount}CPU normal inputs and no human combat input. ${fullMatchLifecycle ? 'Complete match, equal frozen results, human-gated CPU rematch and reset' : 'Short-window observation'}, live state equality, tick sequence, natural hits and disconnect cleanup; not browser rendering/original combat formulas.`,
    mode, mapId, cpuCount, elapsedMs: ended - started, startTick, endTick: final.tick, matchedTicks, maxPeerArrivalSkewMs,
    frames, final, events, roundCombatEvents, matchedCombatEvents, cpuCombat, fullMatchLifecycle,
    secondRound, twoRounds, disconnectCleanup: removed};
  writeFileSync(`recovery/output/cpu-realtime-${mapId}${durationMs === 0 ? '-full' : ''}${cpuCount === 3 ? '' : `-cpu${cpuCount}`}${twoRounds ? '-two-rounds' : ''}.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({status: evidence.status, requireObjective, objectiveVictory,
    allDestroyTargetsCleared, resultReason: final.match?.result?.reason, matchedTicks, frames, fire: roundCombatEvents.filter(event => event.type === 'fire').length,
    hit: roundCombatEvents.filter(isHit).length, matchedCombatEvents, cpuCombat, fullMatchLifecycle, disconnectCleanup: removed}));
  assert(acceptancePassed, `CPU objective acceptance failed: map${mapId}, reason=${final.match?.result?.reason}, remaining=${final.match!.objectives.filter(objective => objective.hp > 0).length}`);
} finally {
  for (const client of clients) await client.disconnect().catch(() => {});
  server.kill();
}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
