import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';

async function main(): Promise<void> {
  const vipOnly = false;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/tank-purchased-waiting-tank-ammo-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-waiting-tank-ammo-'));
  const database = join(directory, 'accounts.sqlite'), port = 3335;
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const accounts = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts;
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database},
    stdio: ['ignore', 'pipe', 'pipe']});
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: vipOnly ? 4 : 2}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => frames[index].push({snapshot, wallTime: Date.now()}));
    client.listenMsg('RoomEvent', event => events[index].push(event));
  });
  const evidence: Record<string, unknown> = {status: 'RUNNING', checkpoint: checkpoint + '-checkpoint.sqlite',
    scope: 'M2-02 first WAITING purchased tank replacement -> ordinary magazine and normal interval; existing direct154 ammo and account qualification reused. Legitimate BUY3/pet2 checkpoint, no live state injection or bound gear assumption.',
    vipOnly, simulationTickSeconds: .05};
  const latest = () => frames[0].at(-1)!.snapshot;
  async function wait(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 15000;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), 'Deadline: ' + log.slice(-600));
  }
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', index < 2 ? {token: accounts[index].token} : {});
      assert(account.isSucc);
      if (index >= 2) {
        const observerOwned = await client.callApi('OwnedRoles', {}); assert(observerOwned.isSucc);
        assert.deepEqual(observerOwned.res, {base: [], equipment: []});
      }
    }
    const owned = await clients[0].callApi('OwnedRoles', {}); assert(owned.isSucc);
    const oldFields = new Map(owned.res.equipment.find(row => new Map(row.fields).get(0x24) === 3)!.fields);
    const bought = await clients[0].callApi('TankShop', {operation: 'BUY', tankId: 154,
      currency: 'MONEY', requestId: 'waiting_ammo_tank154_first'});
    evidence.purchase = bought; assert(bought.isSucc);
    const tankFields = new Map(bought.res.purchased!.fields);
    const profile = await clients[0].callApi('RoleProfile', {}); assert(profile.isSucc);
    assert.equal(new DataView(Uint8Array.from(profile.res.profile!.bytes).buffer).getUint32(0xa8, true), oldFields.get(0x1c));
    evidence.purchaseDoesNotSelect = true;
    const oracle = (fields: Map<number, number>) => recomputeRoleAmmo({
      tank: TANKS.find(row => row.id === fields.get(0x24))!.recomputeBase,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => {assert(fields.has(offset)); return fields.get(offset)!;})},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0});
    const previousExpected = oracle(oldFields), expected = oracle(tankFields); assert(previousExpected && expected);
    assert.notEqual(previousExpected.capacity, expected.capacity);
    assert.notEqual(previousExpected.normalSeconds, expected.normalSeconds);
    evidence.source = {oldFields: [...oldFields], tankFields: [...tankFields], previousExpected, expected,
      boundGear: 'not established', sourcePolicy: 'actual owned fields, no installed extra/parts in checkpoint'};
    const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '等待换车弹匣', name: 'Measured', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id,
      clientId: 'ignored', name: 'Observer', tankId: 3}); assert(guest.isSucc);
    const id = host.res.playerId;
    const player = () => latest().players.find(row => row.id === id)!;
    await wait(() => frames[0].at(-1)?.snapshot.phase === 'WAITING' && player().tankId === 3);
    evidence.beforeSelection = frames[0].at(-1);
    const selected = await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!});
    evidence.selection = selected; assert(selected.isSucc);
    assert.equal(new DataView(Uint8Array.from(selected.res.profile.bytes).buffer).getUint32(0xa8, true), tankFields.get(0x1c));
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    assert.equal(player().tankId, 154); assert.equal(player().petId, 2); assert.equal(player().isVIP, false);
    assert.equal(player().ammoItemId, 2001); assert.equal(player().ammoMagazine!.capacity, expected.capacity);
    assert.equal(player().ammoMagazine!.remaining, expected.capacity); evidence.initial = frames[0].at(-1);
    let sequence = 0;
    const input = (fire: boolean) => clients[0].sendMsg('PlayerInput', {sequence: ++sequence,
      move: 0, turn: 0, aim: 0, fire, useItem: 0, clientTime: Date.now()});
    assert((await input(true)).isSucc);
    await wait(() => player().ammoMagazine?.remaining === expected.capacity - 2);
    assert((await input(false)).isSucc);
    const startTick = (evidence.initial as {snapshot: MsgRoomSnapshot}).snapshot.tick;
    const shots = frames[0].filter(frame => frame.snapshot.tick > startTick && frame.snapshot.players.find(row => row.id === id)?.reload?.startedAt === frame.snapshot.serverTime);
    assert.equal(shots.length, 2);
    const first = shots[0], second = shots[1];
    assert.equal(first.snapshot.players.find(row => row.id === id)!.ammoMagazine!.remaining, expected.capacity - 1);
    assert.equal(second.snapshot.players.find(row => row.id === id)!.ammoMagazine!.remaining, expected.capacity - 2);
    const deadline = first.snapshot.serverTime + expected.normalSeconds * 1000;
    assert(second.snapshot.serverTime >= deadline);
    const eligible = frames[0].find(frame => frame.snapshot.tick > first.snapshot.tick && frame.snapshot.serverTime >= deadline)!;
    assert.equal(second.snapshot.tick, eligible.snapshot.tick);
    evidence.shots = shots; evidence.firstEligible = eligible;
    evidence.interval = {simulationSeconds: (second.snapshot.tick - first.snapshot.tick) * .05,
      serverSeconds: (second.snapshot.serverTime - first.snapshot.serverTime) / 1000,
      wallSeconds: (second.wallTime - first.wallTime) / 1000, deadline, lateMs: second.snapshot.serverTime - deadline};
    await wait(() => events[1].filter(event => event.playerId === id && event.type === 'fire').length === 2);
    const core = (rows: MsgRoomEvent[]) => rows.filter(event => event.playerId === id && event.type === 'fire');
    assert.deepEqual(core(events[0]), core(events[1])); evidence.dualCoreEvents = core(events[0]);
    const key = (frame: {snapshot: MsgRoomSnapshot}) => `${frame.snapshot.roomId}/${frame.snapshot.phase}/${frame.snapshot.tick}`;
    const peers = new Map(frames[1].map(frame => [key(frame), frame]));
    const common = frames[0].filter(frame => frame.snapshot.phase === 'PLAYING' && peers.has(key(frame)));
    for (const frame of common) assert.deepEqual(frame.snapshot.players, peers.get(key(frame))!.snapshot.players);
    evidence.commonFullPlayersObservations = common.length;
    evidence.commonUniqueKeys = new Set(common.map(key)).size;
    evidence.leave = [];
    for (const client of clients) {
      const result = await client.callApi('Leave', {roomId: host.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(result); assert(result.isSucc);
    }
    evidence.status = 'PASS_LIMITED_WAITING_PURCHASED_TANK_AMMO_SOURCE_REPLACEMENT';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    evidence.frames = frames; evidence.events = events;
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2));
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS ' + output + '.json');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
