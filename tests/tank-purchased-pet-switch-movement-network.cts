import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';

async function main(): Promise<void> {
  const vipOnly = false;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/tank-purchased-pet-switch-movement-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-pet-switch-movement-'));
  const database = join(directory, 'accounts.sqlite'), port = 3333;
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
    scope: 'M2-03 first WAITING purchased pet selection replacement -> independent movement source; previous pet2 movement and pet4 purchase reused. Legitimate BUY3/pet2 checkpoint, no live state injection or bound gear assumption.',
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
    const tankFields = new Map(owned.res.equipment.find(row => new Map(row.fields).get(0x24) === 3)!.fields);
    const oldPetFields = new Map(owned.res.base.find(row => new Map(row.fields).get(8) === 2)!.fields);
    assert([0x34, 0x58, 0x5c, 0x60].every(offset => tankFields.has(offset)));
    const profileBefore = await clients[0].callApi('RoleProfile', {}); assert(profileBefore.isSucc);
    const selectedPet = (profile: {bytes: number[]}) => new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(0xa4, true);
    assert.equal(selectedPet(profileBefore.res.profile!), oldPetFields.get(0));
    const bought = await clients[0].callApi('PetShop', {operation: 'BUY', petId: 4,
      currency: 'MONEY', requestId: 'movement_waiting_pet4_switch_first'});
    evidence.purchase = bought; assert(bought.isSucc);
    const profileAfterBuy = await clients[0].callApi('RoleProfile', {}); assert(profileAfterBuy.isSucc);
    assert.equal(selectedPet(profileAfterBuy.res.profile!), oldPetFields.get(0));
    evidence.selectionBefore = {oldPetId: 2, instanceId: oldPetFields.get(0), purchaseDoesNotSelect: true};
    const petFields = new Map(bought.res.purchased!.fields);
    const tank = TANKS.find(row => row.id === tankFields.get(0x24))!;
    const oracle = (petId: number) => recomputeQualifiedRoleMovement({tank: tank.recomputeBase,
      pet: PET_BASES.find(row => row.id === petId)!, ownedField34: tankFields.get(0x34),
      tankType: tank.recomputeBase.tankType,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
      movementScales: ROLE_INITIAL_MOVEMENT_SCALES});
    const previousExpected = oracle(2), expected = oracle(4);
    assert(expected && previousExpected); assert.notEqual(expected.speed, previousExpected.speed);
    assert.notEqual(expected.turn, previousExpected.turn);
    evidence.source = {tankFields: [...tankFields], oldPetFields: [...oldPetFields], newPetFields: [...petFields],
      tankType: tank.recomputeBase.tankType, previousExpected, expected,
      boundGear: 'not established', skillSources: 'actual tank source fields and ordinary2001, no installed extra/part'};
    const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '等待换宠运动', name: 'Measured', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id,
      clientId: 'ignored', name: 'Observer', tankId: 3}); assert(guest.isSucc);
    const selection = await clients[0].callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!});
    evidence.selection = selection; assert(selection.isSucc);
    assert.equal(selectedPet(selection.res.profile), petFields.get(0));
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const id = host.res.playerId;
    const player = () => latest().players.find(row => row.id === id)!;
    assert.equal(player().tankId, 3); assert.equal(player().petId, 4); assert.equal(player().isVIP, false);
    assert.equal(player().maxHp, petFields.get(0x2c));
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
      if (move) {
        assert(Math.abs(distance / seconds - expected.speed) < .3, `${name} distance/s`);
        const projected = (last.player.x - first.player.x) * Math.sin(first.player.yaw)
          + (last.player.z - first.player.z) * Math.cos(first.player.yaw);
        assert.equal(Math.sign(projected), move, `${name} signed displacement`);
      }
      if (turn) assert(Math.abs(body / seconds - turn * expected.turn) < .002, `${name}body signed angle/s`);
      if (aim) {
        assert(Math.abs(turret / seconds - aim * expected.turn) < .002, `${name}turret angle/s`);
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
    evidence.leave = [];
    for (const client of clients) {
      const result = await client.callApi('Leave', {roomId: host.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(result); assert(result.isSucc);
    }
    evidence.status = 'PASS_LIMITED_WAITING_PURCHASED_PET_SWITCH_MOVEMENT';
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
