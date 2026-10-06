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
  const output = `recovery/output/tank-purchased-waiting-part-ammo-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-waiting-part-ammo-'));
  const database = join(directory, 'accounts.sqlite'), port = 3337;
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
    scope: 'M2-02 first WAITING purchased capacity part Equipment refresh -> original ordinary opening magazine; prior direct part capacity/reload evidence reused. Legitimate BUY3/pet2 checkpoint, no live state injection or bound gear assumption.',
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
    const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 15012,
      quantity: 1, currency: 'MONEY', requestId: 'waiting_ammo_part15012_first'});
    evidence.purchase = bought; assert(bought.isSucc);
    const instanceId = bought.res.purchased!.instanceId;
    const beforeEquipment = await clients[0].callApi('Equipment', {operation: 'QUERY'});
    evidence.beforeEquipment = beforeEquipment; assert(beforeEquipment.isSucc); assert.equal(beforeEquipment.res.slots[0], 0);
    const oracle = (withPart: boolean) => recomputeRoleAmmo({
      tank: TANKS.find(row => row.id === oldFields.get(0x24))!.recomputeBase,
      sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => {assert(oldFields.has(offset)); return oldFields.get(offset)!;}).concat(withPart ? [15012, 0, 0, 0, 0, 0, 0] : [])},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0});
    const previousExpected = oracle(false), expected = oracle(true); assert(previousExpected && expected);
    assert.notEqual(previousExpected.capacity, expected.capacity);
    evidence.source = {tankFields: [...oldFields], previousExpected, expected,
      partTableId: 15012, partSkill: combatSkills.get(13092), boundGear: 'not established'};
    const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '等待装配弹匣', name: 'Measured', tankId: 3, minPlayers: 2, maxPlayers: 2}); assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id,
      clientId: 'ignored', name: 'Observer', tankId: 3}); assert(guest.isSucc);
    const id = host.res.playerId;
    const player = () => latest().players.find(row => row.id === id)!;
    await wait(() => frames[0].at(-1)?.snapshot.phase === 'WAITING' && player().tankId === 3);
    evidence.beforeSelection = frames[0].at(-1);
    assert.equal(player().ammoMagazine?.capacity, previousExpected.capacity);
    const readyBefore = await clients[0].callApi('Ready', {round: 1}); assert(readyBefore.isSucc);
    await wait(() => latest().match?.readyPlayerIds.includes(id) === true);
    evidence.readyBefore = frames[0].at(-1);
    const equipped = await clients[0].callApi('Equipment', {operation: 'EQUIP', target: 'PART', slot: 0, instanceId});
    evidence.configuration = equipped; assert(equipped.isSucc); assert.equal(equipped.res.slots[0], instanceId);
    await wait(() => latest().match?.readyPlayerIds.includes(id) === false);
    evidence.readyCancelled = frames[0].at(-1);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    assert.equal(player().tankId, 3); assert.equal(player().petId, 2); assert.equal(player().isVIP, false);
    assert.equal(player().ammoItemId, 2001); assert.equal(player().ammoMagazine!.capacity, expected.capacity);
    assert.equal(player().ammoMagazine!.remaining, expected.capacity); evidence.initial = frames[0].at(-1);
    let sequence = 0;
    const input = (fire: boolean) => clients[0].sendMsg('PlayerInput', {sequence: ++sequence,
      move: 0, turn: 0, aim: 0, fire, useItem: 0, clientTime: Date.now()});
    assert((await input(true)).isSucc);
    await wait(() => player().ammoMagazine?.remaining === expected.capacity - 1);
    assert((await input(false)).isSucc);
    evidence.afterShot = frames[0].at(-1);
    assert.equal(player().ammoMagazine?.capacity, expected.capacity);
    await wait(() => events[1].filter(event => event.playerId === id && event.type === 'fire').length === 1);
    const core = (rows: MsgRoomEvent[]) => rows.filter(event => event.playerId === id && event.type === 'fire');
    assert.deepEqual(core(events[0]), core(events[1])); evidence.dualCoreEvents = core(events[0]);
    const inventory = await clients[0].callApi('Inventory', {}); evidence.afterInventory = inventory; assert(inventory.isSucc);
    const part = inventory.res.records.find(row => row.instanceId === instanceId)!;
    assert.equal(part.itemTableId, 15012); assert.equal(part.ownedQuantity, 1); assert.equal(part.state, 2);
    const equipment = await clients[0].callApi('Equipment', {operation: 'QUERY'}); evidence.afterEquipment = equipment;
    assert(equipment.isSucc); assert.equal(equipment.res.slots[0], instanceId);
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
    evidence.status = 'PASS_LIMITED_WAITING_PURCHASED_PART_AMMO_SOURCE_REFRESH';
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
