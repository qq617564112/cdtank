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
  const vipOnly = true;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/tank-ammo04-vip-last-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-ammo04-delay-'));
  const database = join(directory, 'accounts.sqlite'), port = 3311;
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
    scope: 'M2-02 first VIP purchased2004 last-round reload/finite exhaustion consumer, same source formula; prior purchase/hit/persistence/effects reused. Legitimate BUY3/pet2 checkpoint, no live state injection or bound gear assumption.',
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
    assert([0x58, 0x5c, 0x60].every(offset => tankFields.has(offset)));
    const oracle = (itemId: number) => recomputeRoleAmmo({
      tank: TANKS.find(tank => tank.id === 3)!.recomputeBase,
      sources: {currentSkillIds: combatItemSkills.get(itemId)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}, itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0})!;
    const ordinary = oracle(2001), special = oracle(2004);
    evidence.source = {tankFields: [...tankFields], ordinary, special,
      originalDelayFields: [combatSkills.get(2001)!.attributes.Delay, combatSkills.get(2004)!.attributes.Delay],
      boundGear: 'not established; no selected pet substitution', extraSkill: 'original initialized zero; no installed extra/parts in checkpoint'};
    const bought = await clients[0].callApi('Shop', {operation: 'BUY', itemTableId: 2004,
      quantity: 1, currency: 'MONEY', requestId: 'ammo04_vip_last_first'});
    evidence.purchase = bought; assert(bought.isSucc);
    const assignment = await clients[0].callApi('Kitbag', {operation: 'ASSIGN', slot: 1,
      instanceId: bought.res.purchased!.instanceId});
    evidence.assignment = assignment; assert(assignment.isSucc);
    const host = await clients[0].callApi('CreateRoom', {mode: vipOnly ? 3 : 4, mapId: 7,
      roomName: '速射计时', name: 'Measured', tankId: 3,
      minPlayers: vipOnly ? 4 : 2, maxPlayers: vipOnly ? 4 : 2});
    assert(host.isSucc);
    const guest = await clients[1].callApi('Join', {roomId: host.res.room.id,
      clientId: 'ignored', name: 'Observer', tankId: 3}); assert(guest.isSucc);
    for (const client of clients.slice(2)) {
      const observer = await client.callApi('Join', {roomId: host.res.room.id,
        clientId: 'ignored', name: '普通队员', tankId: 1});
      assert(observer.isSucc);
    }
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const id = host.res.playerId;
    const player = () => latest().players.find(row => row.id === id)!;
    const fires = () => events[0].filter(e => e.playerId === id && e.type === 'fire');
    let sequence = 0;
    async function input(fire: boolean, useItem = 0): Promise<void> {
      assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0,
        aim: 0, fire, useItem, clientTime: Date.now()})).isSucc);
    }
    assert.equal(player().tankId, 3);
    assert.equal(player().isVIP, vipOnly);
    evidence.initial = player();
    await input(false, 2); await wait(() => player().ammoItemId === 2004);
    await input(true); await wait(() => fires().length === 1);
    await wait(() => player().reload!.duration === special.lastBulletSeconds);
    const shotFrame = frames[0].find(row => {
      const shot = row.snapshot.players.find(p => p.id === id);
      return shot?.reload?.startedAt && shot.reload.duration === special.lastBulletSeconds;
    })!;
    assert(shotFrame);
    const shotPlayer = shotFrame.snapshot.players.find(p => p.id === id)!;
    const deadline = shotPlayer.reload!.startedAt + special.lastBulletSeconds * 1000;
    assert.equal(shotPlayer.reload!.duration, special.lastBulletSeconds);
    await wait(() => player().ammoItemId === 2001);
    assert.deepEqual(player().ammoMagazine, {remaining: ordinary.capacity, capacity: ordinary.capacity});
    assert.equal(player().reload!.duration, special.lastBulletSeconds);
    evidence.exhaustedReturn = {snapshot: latest(), wallTime: Date.now()};
    await wait(() => player().reload!.remaining === 0);
    const readyFrame = frames[0].find(row => row.snapshot.tick >= shotFrame.snapshot.tick
      && row.snapshot.players.find(p => p.id === id)?.reload?.remaining === 0)!;
    assert(readyFrame); assert(readyFrame.snapshot.serverTime >= deadline - 1);
    const missed = frames[0].filter(row => row.snapshot.tick > shotFrame.snapshot.tick
      && row.snapshot.tick < readyFrame.snapshot.tick && row.snapshot.serverTime > deadline + 1);
    assert.equal(missed.length, 0);
    assert.equal(fires().length, 1, 'Held depleted-special input must not fire a free ordinary shot');
    evidence.lastReload = {shot: shotFrame, ready: readyFrame, deadline,
      simulationSeconds: (readyFrame.snapshot.tick - shotFrame.snapshot.tick) * .05,
      serverSeconds: (readyFrame.snapshot.serverTime - shotPlayer.reload!.startedAt) / 1000,
      wallSeconds: (readyFrame.wallTime - shotFrame.wallTime) / 1000};
    const stock = await clients[0].callApi('Inventory', {}); assert(stock.isSucc);
    assert.equal(stock.res.records.find(row => row.instanceId === bought.res.purchased!.instanceId)!.ownedQuantity, 0);
    evidence.stockAfter = stock.res;
    await input(false);
    await wait(() => events[1].filter(e => e.type === 'fire' && e.playerId === id).length === 1);
    const core = (rows: MsgRoomEvent[]) => rows.filter(e => e.playerId === id && ['fire', 'ammoConsumed'].includes(e.type));
    assert.deepEqual(core(events[0]), core(events[1]));
    const common = frames[0].filter(a => a.snapshot.phase === 'PLAYING'
      && frames[1].some(b => b.snapshot.tick === a.snapshot.tick && b.snapshot.phase === 'PLAYING'));
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.tick === a.snapshot.tick && b.snapshot.phase === 'PLAYING')!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    assert(common.length > 10); evidence.commonTicks = common.length;
    evidence.leave = [];
    for (const client of clients) {
      const leave = await client.callApi('Leave', {roomId: host.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(leave); assert(leave.isSucc);
    }
    evidence.status = vipOnly ? 'PASS_LIMITED_PURCHASED_VIP2004_LAST_RELOAD_CONSUMER'
      : 'PASS_LIMITED_PURCHASED2004_DELAY_CONSUMER';
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
