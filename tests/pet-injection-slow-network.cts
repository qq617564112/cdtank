import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {readRoleSkillSources} from '../apps/server/src/battle/roles/skill-sources';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/pet-injection-slow-network-${stamp}`;
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-injection-slow-'));
  const database = join(directory, 'accounts.sqlite'), port = 3295;
  let server: ChildProcess | undefined, log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const snapshots: MsgRoomSnapshot[][] = [[], []], events: MsgRoomEvent[][] = [[], []];
  const snapshotTimes: {tick: number; serverTime: number; wallTime: number}[][] = [[], []];
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {snapshots[index].push(snapshot);
      snapshotTimes[index].push({tick: snapshot.tick, serverTime: snapshot.serverTime, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  async function wait(condition: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), log.slice(-700));
  }
  async function start(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database, MATCH_TIME_LIMIT_SECONDS: '60'},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server && server.exitCode === null && server.signalCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve)); server.kill(); await ended;
    }
  }
  const evidence: Record<string, unknown> = {status: 'RUNNING',
    scope: 'First actual item3 cures delivered2008 slow. Funds-only actual BUY3/pet2/2008/item3, normal hit/input, baseline/slow/cured movement, no healing, CAS stock, repeat rejection, dual snapshots and Leave. Original Func10 abnormal mapping remains rebuilt.',
    fixture: 'Two empty new Accounts: funds-only profile100000, all other bytes0; actual BUY/SelectRole provides owned tank3/pet2. No owned/inventory or liveHP/pose/events imports.'};
  const accounts: {accountId: string; token: string}[] = [];
  try {
    await start();
    for (const client of clients) {const account = await client.callApi('Account', {}); assert(account.isSucc); accounts.push(account.res);}
    const store = new AccountStore(database);
    try {
      for (const account of accounts) {
        assert.equal(store.inventory(account.accountId).records.length, 0);
        const bytes = new Uint8Array(0x170);
        new DataView(bytes.buffer).setUint32(0x70, 100000, true);
        store.replaceRoleProfile(account.accountId, {bytes, strings: ['', '']});
      }
    } finally {store.close();}
    const purchases = [];
    for (const client of clients) {
      const beforeOwned = await client.callApi('OwnedRoles', {}); assert(beforeOwned.isSucc);
      assert.deepEqual(beforeOwned.res, {base: [], equipment: []});
      const tank = await client.callApi('TankShop', {operation: 'BUY', tankId: 3,
        currency: 'MONEY', requestId: 'slow_injection_tank'}); assert(tank.isSucc);
      const pet = await client.callApi('PetShop', {operation: 'BUY', petId: 2,
        currency: 'MONEY', requestId: 'slow_injection_pet'}); assert(pet.isSucc);
      const tankFields = new Map(tank.res.purchased!.fields), petFields = new Map(pet.res.purchased!.fields);
      assert((await client.callApi('SelectRole', {kind: 'tank', instanceId: tankFields.get(0x1c)!})).isSucc);
      assert((await client.callApi('SelectRole', {kind: 'pet', instanceId: petFields.get(0)!})).isSucc);
      purchases.push({tank: tank.res, pet: pet.res});
    }
    evidence.rolePurchases = purchases;
    const ownedTank = purchases[1].tank.purchased!, ownedPet = purchases[1].pet.purchased!;
    const equipment = {name: ownedTank.name, fields: new Map(ownedTank.fields)};
    const baseFields = new Map(ownedPet.fields);
    const actualTank = TANKS.find(row => row.id === equipment.fields.get(0x24))!;
    const actualPet = PET_BASES.find(row => row.id === baseFields.get(8))!;
    const oracleRole = createRoleCombatState();
    for (const id of combatItemSkills.get(2001)!.skillIds) if (id) oracleRole.addSkill(id);
    const originalMovement = () => {
      const value = recomputeQualifiedRoleMovement({tank: actualTank.recomputeBase, pet: actualPet,
        ownedField34: equipment.fields.get(0x34), tankType: actualTank.recomputeBase.tankType,
        sources: readRoleSkillSources({currentSkillIds: [...oracleRole.record!.arrays.get(4)!],
          boundGear: undefined, equipment, roleFields: oracleRole.record!.numericFields!}),
        skills: combatSkills, items: combatItemSkills, limits: combatLimits,
        roleValue9: oracleRole.recomputeCounter, movementScales: ROLE_INITIAL_MOVEMENT_SCALES});
      assert(value); return value;
    };
    const expectedBaseline = originalMovement(); oracleRole.addSkill(4006);
    const expectedSlow = originalMovement(); oracleRole.removeSkill(4006);
    evidence.expected = {tankId: actualTank.id, petId: actualPet.id,
      ownedField34: equipment.fields.get(0x34), baseline: expectedBaseline, slowed: expectedSlow,
      source: 'Actual purchased fields, readRoleSkillSources, original qualified movement module; no boundGear inferred',
      acquisitionPolicy: 'Paid availability/owned initial fields including+34=0 are reconstructed'};

    const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 2008,
      quantity: 1, currency: 'MONEY', requestId: 'slow_purchase'}); assert(bought.isSucc);
    const slowInstance = bought.res.purchased!.instanceId;
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 1, instanceId: slowInstance})).isSucc);
    const injection = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 3,
      quantity: 2, currency: 'MONEY', requestId: 'injection_purchase'}); assert(injection.isSucc);
    const cureInstance = injection.res.purchased!.instanceId;
    assert((await clients[1].callApi('Kitbag', {operation: 'ASSIGN', slot: 4, instanceId: cureInstance})).isSucc);
    evidence.purchase = {slow: bought.res, injection: injection.res};
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '解除减速', name: 'Medic', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id, clientId: 'ignored', name: 'Patient', tankId: 3}); assert(joined.isSucc);
    const ownerId = created.res.playerId, targetId = joined.res.playerId, roomId = created.res.room.id;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => snapshots[0].at(-1)?.phase === 'PLAYING');
    const sequences = [0, 0];
    const sendInput = async (index: number, move = 0, aim = 0, fire = false, useItem = 0) => {
      assert((await clients[index].sendMsg('PlayerInput', {sequence: ++sequences[index], move,
        turn: 0, aim, fire, useItem, clientTime: Date.now()})).isSucc);
    };
    const input = (aim = 0, fire = false, useItem = 0) => sendInput(0, 0, aim, fire, useItem);
    const player = (id: string) => snapshots[0].at(-1)!.players.find(p => p.id === id)!;
    const measure = async (name: string, move = 1) => {
      await sendInput(1, move);
      const sentTick = snapshots[0].at(-1)!.tick;
      await wait(() => snapshots[0].at(-1)!.tick >= sentTick + 7);
      await sendInput(1);
      const rows = snapshots[0].filter(frame => frame.phase === 'PLAYING'
        && frame.tick >= sentTick + 1 && frame.tick <= sentTick + 6);
      assert.equal(rows.length, 6, 'Six consecutive movement observations required');
      let distance = 0;
      for (let index = 1; index < rows.length; index++) {
        const before = rows[index - 1].players.find(p => p.id === targetId)!;
        const after = rows[index].players.find(p => p.id === targetId)!;
        distance += Math.hypot(after.x - before.x, after.z - before.z);
      }
      const first = rows[0], last = rows.at(-1)!;
      const firstWall = snapshotTimes[0].find(row => row.tick === first.tick)!;
      const lastWall = snapshotTimes[0].find(row => row.tick === last.tick)!;
      const simulatedSeconds = (last.tick - first.tick) * .05;
      return {name, move, ticks: rows.map(row => row.tick), distance, simulatedSeconds,
        serverSeconds: (last.serverTime - first.serverTime) / 1000,
        wallSeconds: (lastWall.wallTime - firstWall.wallTime) / 1000,
        speedPerSimulatedSecond: distance / simulatedSeconds};
    };
    const baseline = await measure('baseline');
    evidence.baseline = baseline;
    await input(0, false, 2); await wait(() => player(ownerId).ammoItemId === 2008);
    let aimed = false;
    for (let tick = 0; tick < 300; tick++) {
      const owner = player(ownerId), target = player(targetId);
      const desired = Math.atan2(target.x - owner.x, target.z - owner.z);
      const difference = Math.atan2(Math.sin(desired - owner.yaw - owner.aim), Math.cos(desired - owner.yaw - owner.aim));
      if (Math.abs(difference) < .025) {aimed = true; break;}
      await input(Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aimed); await input(0, true);
    await wait(() => events[0].some(event => event.type === 'ammoSlowed' && event.targetId === targetId));
    await input();
    const slowEvent = events[0].find(event => event.type === 'ammoSlowed' && event.targetId === targetId)!;
    const slowed = await measure('slowed'); evidence.slowed = slowed;
    assert(Math.abs(baseline.speedPerSimulatedSecond - expectedBaseline.speed) < .1);
    assert(Math.abs(slowed.speedPerSimulatedSecond - expectedSlow.speed) < .1);
    const beforeCure = {...player(targetId)}; evidence.beforeCure = beforeCure;
    await sendInput(1, 0, 0, false, 5);
    await wait(() => events[0].some(event => event.type === 'itemUsed' && event.skillId === 3));
    await wait(() => events[1].some(event => event.type === 'itemUsed' && event.skillId === 3));
    const used = events[0].find(event => event.type === 'itemUsed' && event.skillId === 3)!;
    assert.deepEqual(used, events[1].find(event => event.type === 'itemUsed' && event.skillId === 3));
    const afterCure = {...player(targetId)};
    assert.equal(afterCure.hp, beforeCure.hp, 'Cure must not heal');
    assert.equal(afterCure.maxHp, beforeCure.maxHp);
    const restored = await measure('cured', -1); evidence.restored = restored;
    assert(Math.abs(restored.speedPerSimulatedSecond - baseline.speedPerSimulatedSecond) < .1);
    const stock = await clients[1].callApi('Inventory', {}); assert(stock.isSucc);
    assert.equal(stock.res.records.find(row => row.instanceId === cureInstance)!.ownedQuantity, 1);
    await sendInput(1, 0, 0, false, 5);
    await wait(() => events[0].some(event => event.type === 'itemRejected' && event.playerId === targetId));
    const repeatStock = await clients[1].callApi('Inventory', {}); assert(repeatStock.isSucc);
    assert.equal(repeatStock.res.records.find(row => row.instanceId === cureInstance)!.ownedQuantity, 1);
    evidence.cure = {slowEvent, used, afterCure, stock: stock.res, repeatStock: repeatStock.res};
    for (const client of clients) assert((await client.callApi('Leave', {roomId, round: 1})).isSucc);
    const common = snapshots[0].filter(frame => frame.phase === 'PLAYING'
      && snapshots[1].some(other => other.roomId === frame.roomId && other.tick === frame.tick));
    assert(common.length > 10);
    for (const frame of common) {
      const other = snapshots[1].find(other => other.roomId === frame.roomId && other.tick === frame.tick)!;
      assert.deepEqual(frame.players, other.players);
    }
    evidence.commonTicks = common.length;
    evidence.normalLeaves = 2;
    evidence.status = 'PASS_PURCHASED_SLOW_INJECTION'; console.log(`PASS ${output}.json`);
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {await stop(); evidence.snapshots = snapshots; evidence.events = events;
    evidence.snapshotTimes = snapshotTimes; evidence.simulatedTickSeconds = .05; evidence.cleaned = true;
    writeFileSync(`${output}.json`, JSON.stringify(evidence, null, 2)); writeFileSync(`${output}.log`, log);
    rmSync(directory, {recursive: true, force: true});}
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
