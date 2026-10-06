import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomEvent, MsgRoomSnapshot} from '../apps/shared/protocols';
import {getBattlefield} from '../apps/server/src/battlefield';
import {getSceneCrushes} from '../apps/server/src/scene-objects';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';

interface ContactObject {
  id: string;
  sourcePlacementId: string;
  sourceModel: string;
  enabled: boolean;
  hidden: boolean;
}

async function main(): Promise<void> {
  // Run only after the compiled release signal for this formal contact interface.
  const port = Number(process.env.CRUSH_CONTACT_PORT);
  assert(Number.isInteger(port) && port > 0, 'Provide the coordinated compiled-release Crush contact port');
  const stateField = 'sceneCrushes';
  const eventType = 'sceneCrushed';
  const targetId = 'CRUSH:76';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/role-crush-contact-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-crush-contact-'));
  const database = join(directory, 'accounts.sqlite');
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const identities = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts;
  const clients = [0, 1].map(() => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000},
  }));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  const inputs: unknown[] = [];
  const sequence = [0, 0];
  let server: ChildProcess | undefined;
  let log = '';
  const evidence: Record<string, unknown> = {
    status: 'RUNNING', port, stateField, eventType,
    fixture: 'Two checkpoint identities with actual purchased tank3/pet2; no BUY, owned/profile/inventory writes or active state injection.',
    checkpoint: checkpoint + '-checkpoint.sqlite', simulationTickSeconds: .05,
    scope: 'Prepared Map07 two ordinary purchased-source Accounts; normal movement contacts source Crush76, original type100 formal hidden state/core event dual-same, movement continues, repeat stays hidden, no fire/shotItemResult/damage/score, dual normal Leave. No rendering or original enabled/authority claim.',
  };
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)!.snapshot;
  const objects = (snapshot: MsgRoomSnapshot): ContactObject[] => {
    const rows = (snapshot.match as unknown as Record<string, unknown>)[stateField];
    assert(Array.isArray(rows), `Missing released match.${stateField}`);
    return rows as ContactObject[];
  };
  const target = () => {
    const row = objects(latest()).find(object => object.id === targetId);
    assert(row && typeof row.hidden === 'boolean', 'Source76 hidden projection required');
    return row;
  };
  async function wait(condition: () => boolean, timeout = 10000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), 'Stage timeout; inspect saved snapshots/server log');
  }
  async function input(move = 0, turn = 0): Promise<void> {
    const message = {sequence: ++sequence[0], move, turn, aim: 0, fire: false,
      useItem: 0, clientTime: Date.now()};
    inputs.push({tick: latest().tick, serverTime: latest().serverTime,
      wallTime: Date.now(), message});
    assert((await clients[0].sendMsg('PlayerInput', message)).isSucc);
  }
  try {
    server = spawn(process.execPath, ['dist/release/server/server/src/index.js'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) assert((await client.connect()).isSucc);
    for (const [index, client] of clients.entries()) {
      const response = await client.callApi('Account', index < 2 ? {token: identities[index].token} : {});
      assert(response.isSucc);
    }
    const owned = await clients[0].callApi('OwnedRoles', {}); assert(owned.isSucc);
    evidence.actorOwnedSource = owned.res;
    const created = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7,
      roomName: '原物件接触', name: 'Actor', tankId: 3, minPlayers: 2, maxPlayers: 2});
    evidence.creation = created; assert(created.isSucc, JSON.stringify(created));
    const actorId = created.res.playerId;
    for (let index = 1; index < clients.length; index++) {
      const joined = await clients[index].callApi('Join', {roomId: created.res.room.id,
        clientId: 'ignored', name: `Observer${index}`, tankId: index < 2 ? 3 : 1});
      (evidence.admissions ??= [] as unknown[]);
      (evidence.admissions as unknown[]).push({index, response: joined});
      assert(joined.isSucc, JSON.stringify(joined));
    }
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    assert(!target().hidden);
    const initial = latest(); evidence.initial = initial;
    assert.equal(objects(initial).length, 3);
    assert.deepEqual(objects(initial).map(row => [row.sourcePlacementId, row.enabled, row.hidden]),
      [['75', false, true], ['76', true, false], ['77', true, false]]);
    assert.equal(target().sourcePlacementId, '76');
    assert.equal(target().sourceModel, 'obj05420');
    const field = getBattlefield(7), navigation = createOriginalBotNavigation(field);
    const source = getSceneCrushes(7).find(row => row.id === '76')!;
    const near = {x: source.matrix[12], y: 0, z: source.matrix[14] + 90};
    const crush = {x: source.matrix[12], y: 0, z: source.matrix[14]};
    evidence.contactSource = source;
    const deadline = Date.now() + 45000;
    let reachedNear = false;
    while (!target().hidden && Date.now() < deadline) {
      assert.equal(latest().phase, 'PLAYING');
      const player = latest().players.find(row => row.id === actorId)!;
      assert(player.alive);
      reachedNear ||= Math.hypot(player.x - near.x, player.z - near.z) < 70;
      const goal = reachedNear ? crush : near;
      const route = findBotPath(field, player, goal, navigation);
      const point = route.find(row => Math.hypot(row.x - player.x, row.z - player.z) > 35) ?? goal;
      const bearing = Math.atan2(point.x - player.x, point.z - player.z);
      const delta = Math.atan2(Math.sin(bearing - player.yaw), Math.cos(bearing - player.yaw));
      await input(Math.abs(delta) < .12 ? 1 : 0, Math.abs(delta) > .06 ? (delta > 0 ? 1 : -1) : 0);
      const tick = latest().tick;
      await wait(() => latest().tick >= tick + 2);
    }
    await input();
    assert(target().hidden, 'Normal input did not trigger source76 contact');
    evidence.firstHidden = latest();
    const hiddenTick = latest().tick;
    await wait(() => latest().tick >= hiddenTick + 5);
    const after = latest().players.find(row => row.id === actorId)!;
    await input(1);
    const beforeTick = latest().tick;
    await wait(() => latest().tick >= beforeTick + 8);
    await input();
    const moved = latest().players.find(row => row.id === actorId)!;
    const distance = Math.hypot(moved.x - after.x, moved.z - after.z);
    assert(distance > 5, 'Movement must remain permitted after contact');
    evidence.continuedMovement = {before: after, after: moved, distance,
      simulationSeconds: (latest().tick - beforeTick) * .05};
    assert(target().hidden);
    for (const original of initial.players) {
      const current = latest().players.find(row => row.id === original.id)!;
      assert.equal(current.hp, original.hp);
      assert.equal(current.maxHp, original.maxHp);
      assert.equal(current.score, original.score);
      assert.equal(current.kills, original.kills);
      assert.equal(current.deaths, original.deaths);
    }
    evidence.unchangedLifeAndScore = true;
    const key = (s: MsgRoomSnapshot) => `${s.roomId}/${s.match?.round}/${s.phase}/${s.tick}`;
    const maps = frames.slice(1).map(rows => new Map(rows
      .filter(row => row.snapshot.phase === 'PLAYING')
      .map(row => [key(row.snapshot), row.snapshot])));
    const common = frames[0].filter(row => row.snapshot.phase === 'PLAYING'
      && maps.every(map => map.has(key(row.snapshot))));
    assert(common.some(row => objects(row.snapshot).find(object => object.id === targetId)?.hidden));
    for (const row of common) for (const map of maps) {
      assert.deepEqual(row.snapshot.players, map.get(key(row.snapshot))!.players);
      assert.deepEqual(objects(row.snapshot), objects(map.get(key(row.snapshot))!));
    }
    const core = (rows: MsgRoomEvent[]) => rows.filter(event => event.type === eventType && event.targetId === targetId);
    await wait(() => events.every(rows => core(rows).length === 1));
    for (const rows of events.slice(1)) assert.deepEqual(core(events[0]), core(rows));
    assert.deepEqual((core(events[0])[0] as MsgRoomEvent & {
      sceneCrush?: {placementId: string};
    }).sceneCrush, {placementId: '76'});
    assert(core(events[0]).every(event => !event.shotItemResult), 'Movement contact must not fabricate a shot result');
    assert(events[0].every(event => !['fire', 'hit', 'destroy'].includes(event.type)));
    evidence.commonObservations = common.length; evidence.commonKeys = [...new Set(common.map(row => key(row.snapshot)))];
    evidence.coreEvents = core(events[0]); evidence.leave = [];
    for (const client of clients) {
      const leave = await client.callApi('Leave', {roomId: created.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(leave); assert(leave.isSucc);
    }
    evidence.status = 'PASS_LIMITED_ORDINARY_CRUSH_CONTACT_NETWORK';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server?.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.cleaned = true; evidence.frames = frames; evidence.events = events; evidence.inputs = inputs;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
