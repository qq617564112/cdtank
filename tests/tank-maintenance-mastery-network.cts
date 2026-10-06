import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ReqTankMaintenance, ResTankMaintenance} from '../apps/shared/protocols/PtlTankMaintenance';
import type {OwnedRoleRecordData} from '../apps/shared/protocols/PtlOwnedRoles';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}
const fields = (record: OwnedRoleRecordData) => new Map(record.fields);
const projection = ({owned, profile, money, tokens}: ResTankMaintenance) => ({owned, profile, money, tokens});

async function main(): Promise<void> {
  const port = Number(process.env.TANK_MAINTENANCE_MASTERY_PORT);
  assert.equal(port, 3613, 'Use the coordinated maintenance mastery window');
  const source = 'recovery/output/part-maintenance-network-2026-10-05T20-04-00-182Z';
  const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as {accountId: string; token: string}[];
  assert.equal(identities.length, 2);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-maintenance-mastery-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/tank-maintenance-mastery-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port,
    fixture: {source: source + '-checkpoint.sqlite', newFundsInjected: false, newOwnershipInjected: false},
    scope: 'Selected Tank3 zero minutes versus ordinary WAITING one-day maintenance, one zero-minute forward baseline and maintained forward/body/independent aim, dual complete players and normal Leave. Existing quote/reject/restart evidence reused.'};
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  const calls: unknown[] = [];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  let server: ChildProcess | undefined, log = '';
  async function wait(predicate: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), log.slice(-800));
  }
  async function start(): Promise<void> {
    const from = log.length;
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(from).includes(`Server started at ${port}.`));
  }
  async function stop(): Promise<void> {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve)); server.kill(); await closed;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      await must(client.callApi('Account', {token: identities[index].token}));
    }
  }
  async function maintain(index: number, request: ReqTankMaintenance): Promise<ResTankMaintenance> {
    const result = await clients[index].callApi('TankMaintenance', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(result.isSucc, JSON.stringify(result)); return result.res;
  }
  try {
    await start(); await authenticate();
    const initial = await maintain(0, {operation: 'QUERY'});
    const tankRecord = initial.owned.equipment.find(row => fields(row).get(0x24) === 3)!;
    const petRecord = initial.owned.base.find(row => fields(row).get(8) === 2)!;
    assert(tankRecord && petRecord);
    const tankFields = fields(tankRecord), petFields = fields(petRecord);
    const instanceId = tankFields.get(0x1c)!;
    assert.equal(tankFields.get(0x34), 0);
    for (const [index, client] of clients.entries()) {
      const roles = await must(client.callApi('OwnedRoles', {}));
      await must(client.callApi('SelectRole', {kind: 'tank', instanceId: index === 0 ? instanceId : fields(roles.equipment[0]).get(0x1c)!}));
      await must(client.callApi('SelectRole', {kind: 'pet', instanceId: index === 0 ? petFields.get(0)! : fields(roles.base[0]).get(0)!}));
    }
    const equipment = await must(clients[0].callApi('Equipment', {operation: 'QUERY'}));
    evidence.equipment = equipment;
    // This checkpoint has no installed part; do not silently infer unequipped input from inventory.
    const profile = Uint8Array.from(initial.profile!.bytes), view = new DataView(profile.buffer);
    for (const offset of [0x148, 0x14c, 0x150, 0x154, 0x158]) assert.equal(view.getUint32(offset, true), 0);
    evidence.initial = initial;
    const tank = TANKS.find(row => row.id === 3)!, pet = PET_BASES.find(row => row.id === 2)!;
    let sequence = 0;
    const rounds: unknown[] = [], expectedValues: {speed: number; turn: number}[] = [];
    for (const maintained of [false, true]) {
      const from = frames.map(rows => rows.length);
      const created = await must(clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '维修精通',
        name: 'Maintainer', tankId: 3, minPlayers: 2, maxPlayers: 2}));
      const peerRoles = await must(clients[1].callApi('OwnedRoles', {}));
      const joined = await must(clients[1].callApi('Join', {roomId: created.room.id, clientId: 'ignored',
        name: 'Peer', tankId: fields(peerRoles.equipment[0]).get(0x24)!}));
      let current = await maintain(0, {operation: 'QUERY'});
      if (maintained) {
        await must(clients[0].callApi('Ready', {round: 1}));
        await wait(() => frames[0].at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId) === true);
        current = await maintain(0, {operation: 'MAINTAIN', instanceId, days: 1, currency: 1,
          requestId: 'maintenance_mastery_first_one_day'});
        assert.equal(current.maintained?.remainingMinutes, 1440);
        await wait(() => !frames[0].at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId));
        evidence.maintenance = current;
      }
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => frames.every(rows => rows.at(-1)?.snapshot.roomId === created.room.id && rows.at(-1)?.snapshot.phase === 'PLAYING'));
      const latest = () => frames[0].at(-1)!.snapshot;
      const player = latest().players.find(row => row.id === created.playerId)!;
      assert.equal(player.tankId, 3); assert.equal(player.petId, 2); assert(player.roleSkillSources);
      const minutes = current.tanks.find(row => row.instanceId === instanceId)!.remainingMinutes;
      assert.equal(minutes, maintained ? 1440 : 0);
      const sources = player.roleSkillSources!;
      assert.deepEqual(sources.equipmentSkills, Array.from({length: 6}, (_, slot) => ({
        baseId: petFields.get(0x44 + slot * 4)!, rank: petFields.get(0x5c + slot * 4)!})));
      const expected = recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet, ownedField34: minutes,
        tankType: tank.recomputeBase.tankType,
        sources: {currentSkillIds: sources.currentSkillIds, equipmentSkills: sources.equipmentSkills,
          extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!).concat(Array<number>(7).fill(0))},
        skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
        movementScales: ROLE_INITIAL_MOVEMENT_SCALES});
      assert(expected); expectedValues.push(expected);
      const segments = [];
      const windows = maintained ? [['forward', 1, 0, 0], ['body', 0, 1, 0], ['aim', 0, 0, 1]] as const
        : [['forward', 1, 0, 0]] as const;
      for (const [name, move, turn, aim] of windows) {
        const startTick = latest().tick;
        assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move, turn, aim,
          fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
        await wait(() => latest().tick >= startTick + 8);
        const samples = frames[0].slice(from[0]).filter(row => row.snapshot.roomId === created.room.id
          && row.snapshot.phase === 'PLAYING' && row.snapshot.tick > startTick + 1 && row.snapshot.tick <= startTick + 8)
          .map(row => ({...row, player: row.snapshot.players.find(value => value.id === created.playerId)!}));
        assert(samples.length >= 6);
        const first = samples[0], last = samples.at(-1)!;
        const simulationSeconds = (last.snapshot.tick - first.snapshot.tick) * .05;
        let distance = 0, body = 0, turret = 0;
        for (let index = 1; index < samples.length; index++) {
          const a = samples[index - 1].player, b = samples[index].player;
          distance += Math.hypot(b.x - a.x, b.z - a.z);
          const wrap = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));
          body += wrap((b.bodyYaw ?? b.yaw) - (a.bodyYaw ?? a.yaw)); turret += wrap(b.aim - a.aim);
        }
        if (move) {
          assert(Math.abs(distance / simulationSeconds - expected.speed) < .3, name + ' uniform speed');
          const signed = (last.player.x - first.player.x) * Math.sin(first.player.yaw)
            + (last.player.z - first.player.z) * Math.cos(first.player.yaw);
          assert.equal(Math.sign(signed), move);
        }
        if (turn) assert(Math.abs(body / simulationSeconds - expected.turn) < .002, 'uniform body turn');
        if (aim) {assert(Math.abs(turret / simulationSeconds - expected.turn) < .002, 'uniform aim turn'); assert(Math.abs(body) < .0002);}
        segments.push({name, input: {move, turn, aim}, samples, distance, body, turret, simulationSeconds,
          serverSeconds: (last.snapshot.serverTime - first.snapshot.serverTime) / 1000,
          wallSeconds: (last.wallTime - first.wallTime) / 1000});
      }
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0, aim: 0,
        fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
      const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
      const peers = new Map(frames[1].slice(from[1]).filter(row => row.snapshot.phase === 'PLAYING').map(row => [key(row.snapshot), row.snapshot]));
      const common = new Map(frames[0].slice(from[0]).filter(row => row.snapshot.phase === 'PLAYING' && peers.has(key(row.snapshot))).map(row => [key(row.snapshot), row.snapshot]));
      assert(common.size >= (maintained ? 20 : 6));
      for (const [id, snapshot] of common) assert.deepEqual(snapshot.players, peers.get(id)!.players);
      const leave = [];
      for (const client of clients) leave.push(await must(client.callApi('Leave', {roomId: created.room.id, round: 1})));
      rounds.push({maintained, minutes, created, joined, expected, segments, commonKeys: [...common.keys()], leave});
    }
    assert(expectedValues[1].speed > expectedValues[0].speed);
    assert(expectedValues[1].turn > expectedValues[0].turn);
    evidence.rounds = rounds;
    assert(!events.flat().some(row => row.type === 'fire'));
    const final = await maintain(0, {operation: 'QUERY'}); evidence.final = final;
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const record = JSON.parse(String(native.prepare('SELECT record FROM role_records WHERE account_id = ? AND instance_id = ?')
        .get(identities[0].accountId, instanceId)!.record)) as OwnedRoleRecordData;
      assert.deepEqual(record, final.owned.equipment.find(row => fields(row).get(0x1c) === instanceId));
      assert.equal(fields(record).get(0x34), 1440); evidence.nativeRecord = record;
    } finally {native.close();}
    evidence.status = 'PASS_FINITE_SELECTED_TANK_MAINTENANCE_EFFECTIVE_MASTERY_MOVEMENT_DUAL_NETWORK_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect(); await stop();
    if (existsSync(database)) {
      const saved = new DatabaseSync(database, {readOnly: true});
      try {await backup(saved, output + '-checkpoint.sqlite');} finally {saved.close();}
      writeFileSync(output + '-identity.private.json', JSON.stringify({accounts: identities}) + '\n', {mode: 0o600});
      evidence.checkpoint = output + '-checkpoint.sqlite';
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.cleaned = true; evidence.frames = frames; evidence.events = events; evidence.calls = calls;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
