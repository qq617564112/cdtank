import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-purchased-move-')), port = 3268;
  const database = join(directory, 'accounts.sqlite');
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database,
      MATCH_TIME_LIMIT_SECONDS: '60'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = Array.from({length: 4}, () => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {wallTime: number; snapshot: MsgRoomSnapshot}[][] = clients.map(() => []);
  const events: MsgRoomEvent[][] = clients.map(() => []);
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({wallTime: Date.now(), snapshot});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)!.snapshot;
  async function wait(check: () => boolean, timeout = 12000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(check(), log.slice(-1200));
  }
  const evidence: Record<string, unknown> = {status: 'RUNNING', mode: 3, mapId: 7,
    scope: 'Actual TankShop/PetShop purchases from initially empty ownership, SelectRole and VIP room ordinary movement/independent body/turret inputs with dual snapshots. Only starting funds/profile imported; no owned-record imports or active state injection.',
    startingProfileFixture: {bytes: 368, moneyOffset: 0x70, money: 100000,
      otherBytes: 0, strings: ['', ''], originalAccountInitialValuesConfirmed: false}};
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    const accounts = [];
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {}); assert(account.isSucc);
      accounts.push(account.res);
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
    }
    // Test funds establish purchase eligibility; all role ownership is produced by BUY.
    const store = new AccountStore(database);
    try {
      const bytes = new Uint8Array(0x170);
      new DataView(bytes.buffer).setUint32(0x70, 100000, true);
      store.replaceRoleProfile(accounts[0].accountId, {bytes, strings: ['', '']});
    } finally {store.close();}
    const tankBuy = await clients[0].callApi('TankShop', {operation: 'BUY', tankId: 3,
      currency: 'MONEY', requestId: 'movement_tank3_buy'}); assert(tankBuy.isSucc);
    const petBuy = await clients[0].callApi('PetShop', {operation: 'BUY', petId: 2,
      currency: 'MONEY', requestId: 'movement_pet2_buy'}); assert(petBuy.isSucc);
    const tankFields = new Map(tankBuy.res.purchased!.fields), petFields = new Map(petBuy.res.purchased!.fields);
    assert((await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!})).isSucc);
    assert((await clients[0].callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!})).isSucc);
    const owned = await clients[0].callApi('OwnedRoles', {}); assert(owned.isSucc);
    assert.deepEqual(owned.res, {base: [petBuy.res.purchased!], equipment: [tankBuy.res.purchased!]});
    evidence.purchases = {tank: tankBuy.res, pet: petBuy.res};
    const tank = TANKS.find(tank => tank.id === tankFields.get(0x24))!, pet = PET_BASES.find(pet => pet.id === petFields.get(8))!;
    const expected = recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet,
      ownedField34: tankFields.get(0x34), tankType: tank.recomputeBase.tankType,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
      movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
    assert(expected); evidence.expected = expected;
    const host = await clients[0].callApi('CreateRoom', {mode: 3, mapId: 7, roomName: '购入运动',
      name: '正式购买', tankId: 1, minPlayers: 4, maxPlayers: 4}); assert(host.isSucc);
    for (const client of clients.slice(1)) assert((await client.callApi('Join', {
      roomId: host.res.room.id, clientId: 'ignored', name: '普通观察', tankId: 1})).isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => latest()?.phase === 'PLAYING');
    const id = host.res.playerId;
    const player = () => latest().players.find(player => player.id === id)!;
    assert.equal(player().tankId, 3); assert.equal(player().petId, 2); assert.equal(player().isVIP, true);
    evidence.initial = latest();
    let sequence = 0;
    const segments = [];
    for (const [name, move, turn, aim] of [
      ['forward', 1, 0, 0], ['reverse', -1, 0, 0],
      ['bodyRight', 0, 1, 0], ['bodyLeft', 0, -1, 0],
      ['turretRight', 0, 0, 1], ['turretLeft', 0, 0, -1], ['stop', 0, 0, 0],
    ] as const) {
      const startTick = latest().tick;
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence,
        move, turn, aim, fire: false, useItem: 0, clientTime: Date.now()})).isSucc);
      await wait(() => latest().tick >= startTick + 10);
      const samples = frames[0].filter(frame => frame.snapshot.tick > startTick + 1
        && frame.snapshot.tick <= startTick + 10);
      assert(samples.length >= 8);
      const values = samples.map(frame => ({...frame,
        player: frame.snapshot.players.find(player => player.id === id)!}));
      const first = values[0], last = values.at(-1)!;
      const seconds = (last.snapshot.tick - first.snapshot.tick) * .05;
      const distance = values.slice(1).reduce((sum, value, index) => sum
        + Math.hypot(value.player.x - values[index].player.x, value.player.z - values[index].player.z), 0);
      const angle = (read: (player: typeof first.player) => number) => values.slice(1).reduce((sum, value, index) => {
        const difference = read(value.player) - read(values[index].player);
        return sum + Math.atan2(Math.sin(difference), Math.cos(difference));
      }, 0);
      const body = angle(player => player.bodyYaw ?? player.yaw), turret = angle(player => player.aim);
      if (move) assert(Math.abs(distance / seconds - expected.speed) < .3, `${name} distance/s`);
      if (turn) assert(Math.abs(Math.abs(body / seconds) - expected.turn) < .002, `${name}body angle/s`);
      if (aim) {
        assert(Math.abs(Math.abs(turret / seconds) - expected.turn) < .002, `${name}turret angle/s`);
        assert(Math.abs(body) < .0002, 'Independent turret input must leave body stable');
      }
      if (name === 'stop') {assert.equal(distance, 0); assert.equal(body, 0); assert.equal(turret, 0);}
      segments.push({name, input: {move, turn, aim}, samples, distance, body, turret,
        simulationSeconds: seconds,
        serverSeconds: (last.snapshot.serverTime - first.snapshot.serverTime) / 1000,
        wallSeconds: (last.wallTime - first.wallTime) / 1000});
    }
    evidence.segments = segments;
    const common = frames[0].filter(a => a.snapshot.phase === 'PLAYING' && frames[1].some(b =>
      b.snapshot.roomId === a.snapshot.roomId && b.snapshot.phase === a.snapshot.phase
      && b.snapshot.tick === a.snapshot.tick));
    assert(common.length > 50);
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.roomId === a.snapshot.roomId
        && b.snapshot.phase === a.snapshot.phase && b.snapshot.tick === a.snapshot.tick)!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    evidence.commonTicks = common.length;
    for (const client of clients) assert((await client.callApi('Leave', {roomId: host.res.room.id, round: 1})).isSucc);
    evidence.status = 'PASS_PURCHASED_TANK3_PET2_VIP_MOVEMENT';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.frames = frames; evidence.events = events; evidence.cleaned = true;
    writeFileSync(`recovery/output/tank-purchased-movement-network-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-purchased-movement-network-${stamp}.log`, log);
  }
  console.log('PASS: actual tank3/pet2 BUY→selection→VIP ordinary movement/body/turret and dual synchronization; only starting profile funds supplied');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
