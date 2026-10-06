import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';
import type {OwnedTankTextures} from '../apps/shared/combat/role-owned-textures';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {ResOwnedRoles} from '../apps/shared/protocols/PtlOwnedRoles';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-texture-network-'));
  const database = join(directory, 'accounts.sqlite');
  const seed = new AccountStore(database);
  const owner = seed.open(), observer = seed.open(), poor = seed.open(), empty = seed.open();
  const instanceId = 0xf1230073, alternateId = instanceId + 1, foreignId = instanceId + 2, missingResourceId = instanceId + 3;
  const evidence: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(
    readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
  const pair = readOwnedRolePairMessage(new Uint8Array(evidence.rows[0].raw), evidence.rows[0].alignment,
    bytes => Buffer.from(bytes).toString('hex'));
  const base = {name: 'Imported network pet', fields: new Map(pair.base.fields)};
  base.fields.set(0, 0xf1230070); base.fields.set(8, 1);
  for (let index = 0; index < 6; index++) {
    base.fields.set(0x44 + index * 4, 0); base.fields.set(0x5c + index * 4, 0);
  }
  const equipment = {name: 'Imported network tank', fields: new Map(pair.equipment.fields)};
  for (const [offset, value] of [[0x1c, instanceId], [0x24, 2], [0x28, 0], [0x2c, 0], [0x30, 0],
    [0x58, 0], [0x5c, 0], [0x60, 0], [0x6c, 3]]) equipment.fields.set(offset, value);
  const alternate = {name: 'Unselected imported tank', fields: new Map(equipment.fields)};
  alternate.fields.set(0x1c, alternateId);
  const missingResource = {name: 'Imported missing-resource tank', fields: new Map(equipment.fields)};
  missingResource.fields.set(0x1c, missingResourceId); missingResource.fields.set(0x24, 151);
  const foreign = {name: 'Observer exclusive tank', fields: new Map(equipment.fields)};
  foreign.fields.set(0x1c, foreignId);
  const bytes = new Uint8Array(0x170);
  bytes[0x10] = 0xa5;
  const profileView = new DataView(bytes.buffer);
  profileView.setUint32(0xa4, base.fields.get(0)!, true);
  profileView.setUint32(0xa8, instanceId, true);
  profileView.setUint32(0x74, 500, true); profileView.setUint32(0x70, 0x80000001, true);
  for (const account of [owner, observer, poor]) {
    seed.replaceRoleRecords(account.accountId, {base: [base],
      equipment: account === owner ? [equipment, alternate, missingResource] : account === observer ? [equipment, foreign] : [equipment]});
    const accountBytes = bytes.slice();
    if (account === poor) new DataView(accountBytes.buffer).setUint32(0x74, 109, true);
    seed.replaceRoleProfile(account.accountId, {bytes: accountBytes, strings: [account.accountId, 'Imported pet']});
  }
  seed.close();
  let server: ChildProcess | undefined, log = '';
  const clients = [owner, observer, poor, empty].map(() => new WsClient(serviceProto,
    {server: 'ws://127.0.0.1:3018', logger: undefined}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [];
  clients.forEach((client, index) => client.listenMsg('RoomSnapshot', state => {snapshots[index] = state;}));
  async function wait(check: () => boolean, timeout = 5000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), `Timeout; server log: ${log.slice(-1500)}`);
  }
  async function start(): Promise<void> {
    log = '';
    snapshots.length = 0;
    const entry = process.env.CDTANK_SERVER_ENTRY;
    server = spawn(process.execPath, entry ? [entry] : ['--import', 'tsx', 'apps/server/src/index.ts'], {
      cwd: process.env.CDTANK_SERVER_CWD ?? process.cwd(),
      env: {...process.env, PORT: '3018', ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', value => {log += String(value);});
    server.stderr!.on('data', value => {log += String(value);});
    await wait(() => log.includes('Server started') || server!.exitCode !== null, 15000);
    assert(log.includes('Server started'), log);
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server && server.exitCode === null) {
      const ended = new Promise<void>(resolve => server!.once('exit', () => resolve()));
      server.kill(); await ended;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [index, account] of [owner, observer, poor, empty].entries()) {
      const response = await clients[index].callApi('Account', {token: account.token});
      assert(response.isSucc); assert.equal(response.res.accountId, account.accountId);
    }
  }
  async function state(client = clients[0]) {
    const owned = await client.callApi('OwnedRoles', {}), profile = await client.callApi('RoleProfile', {});
    assert(owned.isSucc && profile.isSucc);
    return {owned: owned.res, profile: profile.res.profile};
  }
  const paid: OwnedTankTextures = {U: 21011, M: 21012, XY: 20013};
  const next: OwnedTankTextures = {...paid, U: 21021};
  const zero: OwnedTankTextures = {U: 0, M: 0, XY: 0};
  try {
    await start();
    assert(!(await clients[0].callApi('TankTextures', {instanceId, textures: paid})).isSucc);
    await authenticate();
    const initial = await state(), observerBefore = await state(clients[1]), poorBefore = await state(clients[2]);
    assert.deepEqual(await state(clients[3]), {owned: {base: [], equipment: []}, profile: undefined});
    async function reject(client: typeof clients[number], id: number, textures: OwnedTankTextures,
        message?: RegExp): Promise<void> {
      const before = await state(client);
      const response = await client.callApi('TankTextures', {instanceId: id, textures});
      assert(!response.isSucc);
      if (message) assert.match(response.err.message, message);
      assert.deepEqual(await state(client), before, 'Rejected request preserves complete owned records and profile');
    }
    await reject(clients[3], instanceId, paid);
    await reject(clients[0], foreignId, paid);
    await reject(clients[0], instanceId, {...paid, U: paid.M});
    await reject(clients[0], instanceId, {...paid, U: 10011});
    await reject(clients[0], instanceId, {...paid, U: 99999});
    await reject(clients[0], missingResourceId, {U: 1510011, M: 0, XY: 0});
    await reject(clients[0], instanceId, {...paid, U: 21511});
    await reject(clients[2], instanceId, paid, /代币/);
    const allZero = await clients[0].callApi('TankTextures', {instanceId, textures: zero});
    assert(allZero.isSucc); assert.equal(allZero.res.confirmation.result, 0);
    assert.deepEqual(await state(), initial);
    const confirmed = await clients[0].callApi('TankTextures', {instanceId, textures: paid});
    assert(confirmed.isSucc);
    assert.deepEqual(confirmed.res.confirmation, {instanceId, textures: paid, tokens: 390, money: 0x80000001, result: 3});
    const expectedOwned: ResOwnedRoles = structuredClone(initial.owned);
    const selected = expectedOwned.equipment.find(record => record.fields.some(([offset, value]) => offset === 0x1c && value === instanceId))!;
    for (const [offset, value] of [[0x28, paid.U], [0x2c, paid.M], [0x30, paid.XY]]) {
      selected.fields.find(field => field[0] === offset)![1] = value;
    }
    const expectedProfile = structuredClone(initial.profile!);
    const chargedBytes = Uint8Array.from(expectedProfile.bytes);
    new DataView(chargedBytes.buffer).setUint32(0x74, 390, true);
    expectedProfile.bytes = [...chargedBytes];
    assert.deepEqual(confirmed.res.owned, expectedOwned, 'Only the selected record U/M/XY fields change');
    assert.deepEqual(confirmed.res.profile, expectedProfile, 'Only the charged balance changes; profile bytes and strings retain their source values');
    assert.deepEqual(await state(), {owned: expectedOwned, profile: expectedProfile});
    assert.deepEqual(await state(clients[1]), observerBefore, 'Same instance ID in another account remains isolated');
    assert.deepEqual(await state(clients[2]), poorBefore);
    for (const textures of [paid, zero]) {
      const unchanged = await clients[0].callApi('TankTextures', {instanceId, textures});
      assert(unchanged.isSucc);
      assert.deepEqual(unchanged.res, {...confirmed.res, confirmation: {...confirmed.res.confirmation, result: 0}});
    }
    const room = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Tank texture acceptance', name: 'Owner', tankId: 1});
    assert(room.isSucc);
    const guest = await clients[1].callApi('Join', {clientId: 'tank-texture-observer', roomId: room.res.room.id, name: 'Observer', tankId: 1});
    assert(guest.isSucc);
    const player = () => snapshots[0]?.players.find(value => value.id === room.res.playerId);
    const ready = () => snapshots[0]?.match?.readyPlayerIds.includes(room.res.playerId) === true;
    await wait(() => player()?.tankTextures?.U === paid.U);
    assert.equal(player()!.tankId, 2); assert.deepEqual(player()!.tankTextures, paid);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    await wait(ready);
    const repeated = await clients[0].callApi('TankTextures', {instanceId, textures: paid});
    assert(repeated.isSucc); assert.equal(repeated.res.confirmation.result, 0);
    assert(ready(), 'No-op retains readiness');
    await reject(clients[0], instanceId, {...paid, U: paid.M});
    assert(ready(), 'Rejected request retains readiness');
    const changed = await clients[0].callApi('TankTextures', {instanceId, textures: next});
    assert(changed.isSucc);
    assert.deepEqual(changed.res.confirmation, {instanceId, textures: next, tokens: 340, money: 0x80000001, result: 3});
    await wait(() => !ready() && player()?.tankTextures?.U === next.U);
    await wait(() => snapshots[1]?.players.find(value => value.id === room.res.playerId)?.tankTextures?.U === next.U);
    assert.deepEqual(player()!.tankTextures, next);
    assert.deepEqual(snapshots[1]!.players.find(value => value.id === guest.res.playerId)!.tankTextures, zero);
    const persisted = await state();
    assert.deepEqual(persisted, {owned: changed.res.owned, profile: changed.res.profile});
    for (let index = 0; index < 3; index++) assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    assert((await clients[1].callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0]?.phase === 'PLAYING');
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
    await reject(clients[0], instanceId, paid);
    assert.deepEqual(player()!.tankTextures, next);
    await stop(); await start();
    assert(!(await clients[0].callApi('TankTextures', {instanceId, textures: paid})).isSucc);
    await authenticate();
    assert.deepEqual(await state(), persisted);
    assert.deepEqual(await state(clients[1]), observerBefore);
    assert.deepEqual(await state(clients[2]), poorBefore);
    assert.deepEqual(await state(clients[3]), {owned: {base: [], equipment: []}, profile: undefined});
    const restoredRoom = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Persisted textures', name: 'Owner', tankId: 1});
    assert(restoredRoom.isSucc);
    await wait(() => snapshots[0]?.roomId === restoredRoom.res.room.id &&
      snapshots[0].players.find(value => value.id === restoredRoom.res.playerId)?.tankTextures?.U === next.U);
    assert.deepEqual(snapshots[0]!.players.find(value => value.id === restoredRoom.res.playerId)!.tankTextures, next);
    writeFileSync('recovery/output/tank-texture-network.json', JSON.stringify({status: 'PASS', port: 3018,
      scope: 'Actual rebuilt TSRPC API, isolated SQLite account fixtures, ordinary room/Ready/input, confirmation, charge, source preservation, WAITING readiness and snapshot refresh, PLAYING rejection, server restart. No combat state injection.',
      confirmation: confirmed.res.confirmation, waitingConfirmation: changed.res.confirmation,
      authentication: true, emptyAccount: true, foreignOwnership: true, crossComponent: true,
      crossTank: true, unknownResource: true, missingSourceResource: true, rarityZero: true, insufficientTokens: true,
      allZeroNoOp: true, unchangedNoCharge: true, sourcePreservation: true, sameInstanceIsolation: true,
      waitingClearsReady: true, noOpRetainsReady: true, rejectedRetainsReady: true,
      bothClientsReceiveSelectedTextures: true, playingRejects: true, restartRecovery: true,
      persisted}, null, 2));
    console.log('PASS: live tank texture confirmation, source charge/preservation, WAITING refresh, PLAYING rejection and isolated restart persistence');
  } finally {await stop(); rmSync(directory, {recursive: true, force: true});}
}
main().catch(error => {console.error(error); process.exitCode = 1;});
