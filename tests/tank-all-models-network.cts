import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {AccountStore, type AccountSession} from '../apps/server/src/account-store';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatItems, combatSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent, PlayerSnapshot} from '../apps/shared/protocols';
import type {OwnedRoleRecordData} from '../apps/shared/protocols/PtlOwnedRoles';

interface Oracle {tankId: number; capacity: number; normal: number; last: number; move: number; turn: number;}
interface Frame {snapshot: MsgRoomSnapshot; wallTime: number;}
interface Input {move: number; turn: number; aim: number; fire: boolean;}
interface Case {
  tankId: number; status: string; frames: Frame[][]; events: MsgRoomEvent[][];
  [key: string]: unknown;
}
const source = 'recovery/output/tank-ammo-authority-sol.json';
const oldAmmo = ['recovery/output/tank-other-models-ammo-network-2026-10-04T15-55-25-987Z-analysis.json',
  'recovery/output/tank-three-models-ammo-realtime-network-2026-10-04T21-36-12-165Z.json'];
const oldTank1 = 'recovery/output/tank-numeric-network-2026-10-04T14-34-12-516Z-analysis.json';
const table = (name: string): Record<string, string>[] =>
  JSON.parse(readFileSync(`recovery/output/verified/tables/${name}.json`, 'utf8')).rows
    .map((row: {values: Record<string, string>}) => row.values);
const fields = (record: OwnedRoleRecordData): Map<number, number> => new Map(record.fields);
const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
const key = (s: MsgRoomSnapshot): string => `${s.roomId}/${s.match?.round}/${s.phase}/${s.tick}/${s.serverTime}`;

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}

function prepare(): {base: OwnedRoleRecordData; equipment: OwnedRoleRecordData[]; expected: Oracle[]; scope: unknown} {
  const layout = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows[0];
  const pet = table('pet').find(row => Number(row.ID) === 1)!;
  const baseFields = new Map<number, number>(Object.keys(layout.base).map(offset => [Number(offset), 0]));
  for (const [offset, value] of [[0, 73], [8, 1], [0x2c, Number(pet.MaxHP)],
    [0x34, Number(pet.Critical)], [0x3c, Number(pet.Lucky)]]) baseFields.set(offset, value);
  // Neutral decoder-layout fixture matches the accepted tank1 baseline;
  // six skill IDs and ranks stay zero, rather than copying native random fields.
  const base: OwnedRoleRecordData = {name: pet.PetName, fields: [...baseFields]};
  const equipment = table('tank').map((row, index) => {
    const record = new Map<number, number>(Object.keys(layout.equipment).map(offset => [Number(offset), 0]));
    for (const [offset, value] of [[0x1c, 100 + index], [0x24, Number(row.ID)], [0x34, 0],
      [0x3c, Number(row.TankAtk)], [0x40, Number(row.TankAtkBonus)],
      [0x4c, Number(row.TankDef)], [0x50, Number(row.TankDefBonus)], [0x6c, Number(row.TankPartSlot)]]) {
      record.set(offset, value);
    }
    return {name: row.TankName, fields: [...record]};
  });
  assert.equal(equipment.length, 21);
  const accepted = JSON.parse(readFileSync(source, 'utf8'));
  assert.equal(accepted.status, 'PASS');
  const expected = (accepted.rows as Oracle[]).filter(row => row.tankId !== 1);
  assert.equal(expected.length, 20);
  assert.equal(new Set(expected.map(row => row.tankId)).size, 20);
  assert.deepEqual(expected.map(row => row.tankId).sort((a, b) => a - b),
    TANKS.filter(row => row.id !== 1).map(row => row.id).sort((a, b) => a - b));
  // Independent arithmetic/oracle already qualified against original numeric blocks.
  const clamp = (value: number, id: number): number => {
    const limit = combatLimits.get(id)!;
    return Math.max(limit.lower, Math.min(limit.upper, value));
  };
  const ammo = combatItems.get(2001)!;
  const skills = ammo.skillIds.map(id => combatSkills.get(id)).filter(value => value !== undefined);
  const petBase = PET_BASES.find(row => row.id === 1)!;
  for (const row of expected) {
    const tank = TANKS.find(value => value.id === row.tankId)!.recomputeBase;
    const delay = clamp(skills.reduce((sum, skill) => sum + skill.attributes.Delay, tank.reloadDuration), 16);
    const load = skills.reduce((sum, skill) => sum + skill.attributes.LoadTime, 0);
    const capacity = clamp(skills.reduce((sum, skill) => sum + skill.attributes.MaxBullet, tank.field90), 17);
    const mastery = Math.max(1, [petBase.field7c, petBase.field80, petBase.field84, petBase.field88][tank.tankType - 1] - 1);
    assert.equal(row.capacity, capacity);
    assert.equal(row.normal, Math.fround(delay * Math.fround(.1)));
    assert.equal(row.last, Math.fround(delay * Math.fround(.1) * load * Math.fround(.03)));
    assert.equal(row.move, Math.fround(50 + 10 * (mastery + clamp(tank.field84, 14) - 3)));
    assert.equal(row.turn, Math.fround((mastery + clamp(tank.field88, 15) - 3) * Math.fround(4 * Math.PI / 180) + Math.fround(.1919862)));
  }
  return {base, equipment, expected, scope: {
    source, oldTank1, oldAmmo, decodedLayout: 'recovery/output/world-role-attributes-native.json',
    originalTables: ['pet.json', 'tank.json'], petId: 1, petSkillIds: Array<number>(6).fill(0), petRanks: Array<number>(6).fill(0),
    ownedTankMinutes: 0, partFields: [0, 0, 0, 0, 0], funds: 0, inventory: [],
    accounts: 40, connections: 40, mapId: 7, mode: 4,
    noPurchaseOrEarnedClaim: true, runtimeWrites: 'Only ordinary Account/SelectRole/CreateRoom/Join/Ready/PlayerInput/Leave',
  }};
}

async function main(): Promise<void> {
  const fixture = prepare();
  if (process.argv.includes('--prepare')) {
    writeFileSync('recovery/output/tank-all-models-network-preparation.json', JSON.stringify(fixture, null, 2) + '\n');
    console.log('PREPARED: 20 new models; no server or connection started');
    return;
  }
  const port = Number(process.env.TANK_ALL_MODELS_PORT);
  assert.equal(port, 3618, 'Use the coordinated all-models window');
  assert.equal(process.env.TANK_ALL_MODELS_RELEASE, '1', 'Compiled first-run release required');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-all-models-'));
  const database = join(directory, 'accounts.sqlite');
  const output = 'recovery/output/tank-all-models-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const seed = new AccountStore(database), identities: AccountSession[] = [];
  try {
    for (let index = 0; index < 40; index++) {
      const account = seed.open(); identities.push(account);
      seed.replaceRoleRecords(account.accountId, {base: [{name: fixture.base.name, fields: fields(fixture.base)}],
        equipment: fixture.equipment.map(record => ({name: record.name, fields: fields(record)}))});
      seed.replaceRoleProfile(account.accountId, {bytes: new Uint8Array(0x170), strings: ['', '']});
      seed.replaceInventory(account.accountId, []);
    }
  } finally {seed.close();}
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, fixture, reusedTank1: oldTank1, reusedAmmo: oldAmmo,
    tickSeconds: .05, limits: ['Pre-service imported source ownership; not ordinary acquisition or earned growth.',
      'Original client/server damage and refill producers remain open; magazine authority and stationary A/D+Arrow mapping reconstructed.',
      'Pet1/ranks0/part0/minutes0/default2001 only; no special ammo, other pets or equipment combinations claimed.']};
  const cases: Case[] = [], clients: WsClient<ServiceType>[] = [];
  let server: ChildProcess | undefined, log = '';
  async function wait(predicate: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), log.slice(-1000));
  }
  async function stop(): Promise<void> {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve)); server.kill(); await closed;
    }
  }
  try {
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {env: {...process.env,
      PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const [modelIndex, expected] of fixture.expected.entries()) {
      const pair = [0, 1].map(() => new WsClient<ServiceType>(serviceProto, {server: `ws://127.0.0.1:${port}`,
        logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
      clients.push(...pair);
      const row: Case = {tankId: expected.tankId, status: 'RUNNING', expected, frames: [[], []], events: [[], []]};
      cases.push(row);
      pair.forEach((client, side) => {
        client.listenMsg('RoomSnapshot', snapshot => {row.frames[side].push({snapshot, wallTime: Date.now()});});
        client.listenMsg('RoomEvent', event => {row.events[side].push(event);});
      });
      for (const [side, client] of pair.entries()) {
        assert((await client.connect()).isSucc);
        await must(client.callApi('Account', {token: identities[modelIndex * 2 + side].token}));
        const owned = await must<ServiceType['api']['OwnedRoles']['res']>(client.callApi('OwnedRoles', {}));
        assert.equal(owned.equipment.length, 21);
        const tank = owned.equipment.find(record => fields(record).get(0x24) === expected.tankId)!;
        assert(tank); assert.equal(fields(tank).get(0x34), 0);
        await must(client.callApi('SelectRole', {kind: 'pet', instanceId: 73}));
        await must(client.callApi('SelectRole', {kind: 'tank', instanceId: fields(tank).get(0x1c)!}));
      }
      const created = await must<ServiceType['api']['CreateRoom']['res']>(pair[0].callApi('CreateRoom', {mode: 4, mapId: 7,
        roomName: '数值矩阵', name: 'Measured', tankId: expected.tankId, minPlayers: 2, maxPlayers: 2}));
      const joined = await must(pair[1].callApi('Join', {roomId: created.room.id, clientId: 'ignored', name: 'Observer', tankId: expected.tankId}));
      row.created = created; row.joined = joined;
      for (const client of pair) await must(client.callApi('Ready', {round: 1}));
      const latest = (): MsgRoomSnapshot => row.frames[0].at(-1)!.snapshot;
      const player = (snapshot = latest()): PlayerSnapshot => snapshot.players.find(value => value.id === created.playerId)!;
      await wait(() => row.frames.every(frames => frames.at(-1)?.snapshot.phase === 'PLAYING'));
      const initial = player(); row.initial = initial;
      assert.equal(typeof initial.bodyYaw, 'number', 'Formal bodyYaw field required');
      assert.equal(initial.tankId, expected.tankId); assert.equal(initial.petId, 1);
      assert.equal(initial.ammoItemId, 2001); assert.equal(initial.selectedAmmoSlot, 1);
      assert.deepEqual(initial.ammoMagazine, {remaining: expected.capacity, capacity: expected.capacity});
      assert.deepEqual(initial.roleSkillSources?.currentSkillIds.filter(id => id > 0), [2001, 4020]);
      assert.deepEqual(initial.roleSkillSources?.selectedSkillIds, [2001, 4020]);
      assert.deepEqual(initial.roleSkillSources?.equipmentSkills, Array.from({length: 6}, (_, slot) =>
        ({baseId: fields(fixture.base).get(0x44 + 4 * slot)!, rank: 0})));
      let sequence = 0;
      const send = async (input: Input): Promise<void> => {
        assert((await pair[0].sendMsg('PlayerInput', {sequence: ++sequence, ...input, useItem: 0, clientTime: Date.now()})).isSucc);
      };
      const windows: unknown[] = []; row.windows = windows;
      for (const [name, move, turn, aim] of [['forward', 1, 0, 0], ['reverse', -1, 0, 0],
        ['bodyRight', 0, 1, 0], ['bodyLeft', 0, -1, 0], ['aimRight', 0, 0, 1], ['aimLeft', 0, 0, -1]] as const) {
        const startTick = latest().tick;
        await send({move, turn, aim, fire: false});
        await wait(() => latest().tick >= startTick + 8);
        const samples = row.frames[0].filter(frame => frame.snapshot.phase === 'PLAYING'
          && frame.snapshot.tick > startTick + 1 && frame.snapshot.tick <= startTick + 8);
        assert(samples.length >= 6, name + ' complete measurement window');
        const first = samples[0], last = samples.at(-1)!;
        let distance = 0, body = 0, turret = 0;
        for (let index = 1; index < samples.length; index++) {
          const a = player(samples[index - 1].snapshot), b = player(samples[index].snapshot);
          assert.equal(typeof a.bodyYaw, 'number'); assert.equal(typeof b.bodyYaw, 'number');
          distance += Math.hypot(b.x - a.x, b.z - a.z);
          body += wrap(b.bodyYaw! - a.bodyYaw!); turret += wrap(b.aim - a.aim);
          assert(b.alive, 'Ordinary measurement must remain alive');
        }
        const simulationSeconds = (last.snapshot.tick - first.snapshot.tick) * .05;
        if (move) {
          assert(Math.abs(distance / simulationSeconds - expected.move) < .3, `tank${expected.tankId} ${name} speed`);
          const a = player(first.snapshot), b = player(last.snapshot);
          const signed = (b.x - a.x) * Math.sin(a.bodyYaw!) + (b.z - a.z) * Math.cos(a.bodyYaw!);
          assert.equal(Math.sign(signed), move);
        }
        if (turn) assert(Math.abs(body / simulationSeconds - turn * expected.turn) < .002, `tank${expected.tankId} ${name} turn`);
        if (aim) {
          assert(Math.abs(turret / simulationSeconds - aim * expected.turn) < .002, `tank${expected.tankId} ${name} aim`);
          assert(Math.abs(body) < .0002, 'Arrow input leaves body orientation unchanged');
        }
        windows.push({name, input: {move, turn, aim}, firstTick: first.snapshot.tick, lastTick: last.snapshot.tick,
          simulationSeconds, serverSeconds: (last.snapshot.serverTime - first.snapshot.serverTime) / 1000,
          wallSeconds: (last.wallTime - first.wallTime) / 1000, distance, body, turret});
      }
      await send({move: 0, turn: 0, aim: 0, fire: false});
      const finalTick = latest().tick;
      await wait(() => latest().tick >= finalTick + 2);
      await wait(() => row.events[0].length === row.events[1].length);
      assert.deepEqual(row.events[0], row.events[1]);
      assert(!row.events.flat().some(event => event.type === 'fire'), 'Existing ammo matrix reused without firing');
      const peerFrames = new Map(row.frames[1].filter(frame => frame.snapshot.phase === 'PLAYING').map(frame => [key(frame.snapshot), frame.snapshot]));
      const common = new Map(row.frames[0].filter(frame => frame.snapshot.phase === 'PLAYING' && peerFrames.has(key(frame.snapshot)))
        .map(frame => [key(frame.snapshot), frame.snapshot]));
      assert(common.size >= 35);
      for (const [id, snapshot] of common) assert.deepEqual(snapshot, peerFrames.get(id), 'Complete same-time dual snapshot');
      row.commonKeys = [...common.keys()];
      const leaves = [];
      for (const client of pair) leaves.push(await must(client.callApi('Leave', {roomId: created.room.id, round: 1})));
      row.leaves = leaves;
      for (const client of pair) await client.disconnect();
      row.status = 'PASS_FINITE_MODEL_OWNED_BASE_MOVEMENT_DUAL_SNAPSHOT_LEAVE';
      console.log(`PASS model ${expected.tankId}: ${common.size} common snapshots, six movement windows`);
      writeFileSync(output + '.json', JSON.stringify({...evidence, cases}, null, 2) + '\n');
    }
    assert.equal(cases.length, 20);
    evidence.status = 'PASS_FINITE_REMAINING20_TANK_OWNED_BASE_MOVEMENT_DUAL_NETWORK_SCOPE';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect(); await stop();
    if (existsSync(database)) {
      const db = new DatabaseSync(database, {readOnly: true});
      try {await backup(db, output + '-checkpoint.sqlite');} finally {db.close();}
      writeFileSync(output + '-identity.private.json', JSON.stringify({accounts: identities}) + '\n', {mode: 0o600});
      evidence.checkpoint = output + '-checkpoint.sqlite';
    }
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify({...evidence, cases}, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
