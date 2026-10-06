import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomEvent, MsgRoomSnapshot} from '../apps/shared/protocols';
import {TANKS} from '../apps/server/src/config';
import {combatItemSkills, combatLimits, combatSkills} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `recovery/output/tank-ammo-recompute-refill-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-recompute-refill-'));
  const database = join(directory, 'accounts.sqlite');
  const port = Number(process.env.AMMO_RECOMPUTE_PORT);
  assert(Number.isInteger(port) && port > 0, 'AMMO_RECOMPUTE_PORT requires coordinated service window');
  copyFileSync(checkpoint + '-checkpoint.sqlite', database);
  const accounts = JSON.parse(readFileSync(checkpoint + '-identity.private.json', 'utf8')).accounts;
  let server: ChildProcess | undefined;
  let log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined,
    heartbeat: {interval: 5000, timeout: 10000},
  }));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  const sequence = [0, 0];
  const inputs: unknown[] = [];
  const evidence: Record<string, unknown> = {
    status: 'RUNNING', checkpoint: checkpoint + '-checkpoint.sqlite', port,
    scope: 'Real BUY3/pet2 checkpoint and normal BUY6/slot4; speed-drink recomputation while ordinary magazine is empty preserves last-shot deadline and refills once. No live state injection, special ammo, damage/effects or restart claim.',
    simulationTickSeconds: .05,
  };
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const latest = () => frames[0].at(-1)!.snapshot;
  const player = (id: string) => latest().players.find(row => row.id === id)!;
  const capture = () => ({snapshot: latest(), wallTime: Date.now()});
  async function wait(condition: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!condition() && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(condition(), 'Condition deadline; server tail: ' + log.slice(-600));
  }
  async function input(index: number, fire = false, useItem = 0, aim = 0): Promise<void> {
    const value = {sequence: ++sequence[index], move: 0, turn: 0, aim,
      fire, useItem, clientTime: Date.now()};
    inputs.push({index, ...value});
    assert((await clients[index].sendMsg('PlayerInput', value)).isSucc);
  }
  try {
    server = spawn(process.execPath, ['dist/release/server/server/src/index.js'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {token: accounts[index].token})).isSucc);
    }
    const owned = await clients[1].callApi('OwnedRoles', {});
    assert(owned.isSucc);
    const tankFields = new Map(owned.res.equipment.find(row => new Map(row.fields).get(0x24) === 3)!.fields);
    const petFields = new Map(owned.res.base.find(row => new Map(row.fields).get(8) === 2)!.fields);
    const oracle = (itemId: number) => recomputeRoleAmmo({
      tank: TANKS.find(tank => tank.id === 3)!.recomputeBase,
      sources: {currentSkillIds: combatItemSkills.get(itemId)!.skillIds,
        extraSkill: {baseId: 0, rank: 0},
        itemIds: [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
    })!;
    const ordinary = oracle(2001);
    evidence.source = {tankFields: [...tankFields], petFields: [...petFields], ordinary,
      boundGear: 'unqualified; not substituted from selected pet',
      lifecycle: 'Rebuilt ordinary magazine saved-count and deadline-refill policy; original formula reused'};
    const bought = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 6,
      quantity: 1, currency: 'MONEY', requestId: 'drink6_empty_magazine_recompute_first'});
    evidence.purchase = bought; assert(bought.isSucc);
    const instanceId = bought.res.purchased!.instanceId;
    const assigned = await clients[1].callApi('Kitbag', {operation: 'ASSIGN', slot: 4, instanceId});
    evidence.assignment = assigned; assert(assigned.isSucc);
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '空弹重算补给', name: 'Shooter', tankId: 3, minPlayers: 2, maxPlayers: 2});
    evidence.creation = created;
    assert(created.isSucc, JSON.stringify(created));
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id,
      clientId: 'ignored', name: 'Measured', tankId: 3}); assert(joined.isSucc);
    const targetId = joined.res.playerId;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    assert.equal(player(targetId).maxHp, petFields.get(0x2c));
    assert.deepEqual(player(targetId).ammoMagazine, {remaining: ordinary.capacity, capacity: ordinary.capacity});
    evidence.initial = capture();
    const fires = () => events[0].filter(event => event.playerId === targetId && event.type === 'fire');
    await input(1, true);
    await wait(() => player(targetId).ammoMagazine?.remaining === 0 && fires().length === ordinary.capacity, 20000);
    await input(1);
    const last = player(targetId).reload!;
    assert.equal(last.duration, ordinary.lastBulletSeconds);
    const oldDeadline = last.startedAt + last.duration * 1000;
    assert(latest().serverTime < oldDeadline);
    evidence.emptyOrdinary = capture(); evidence.ordinaryDeadline = oldDeadline;
    await input(1, false, 5);
    const uses = () => events[0].filter(event => event.playerId === targetId
      && event.type === 'itemUsed' && event.skillId === 6);
    await wait(() => uses().length === 1 && player(targetId).speedBoost?.skillId === 6);
    assert(latest().serverTime < oldDeadline, 'Recompute must occur before refill deadline');
    assert.equal(player(targetId).ammoItemId, 2001);
    assert.deepEqual(player(targetId).ammoMagazine, {remaining: 0, capacity: ordinary.capacity});
    assert.equal(player(targetId).reload!.startedAt, last.startedAt);
    assert.equal(player(targetId).reload!.duration, last.duration);
    evidence.recomputedEmpty = capture();
    await input(1);
    await wait(() => latest().serverTime >= oldDeadline
      && player(targetId).ammoMagazine?.remaining === ordinary.capacity);
    const emptyUntilDeadline = frames[0].filter(row => row.snapshot.serverTime >=
      (evidence.recomputedEmpty as ReturnType<typeof capture>).snapshot.serverTime
      && row.snapshot.serverTime < oldDeadline);
    assert(emptyUntilDeadline.length > 20);
    for (const row of emptyUntilDeadline) {
      const actor = row.snapshot.players.find(actor => actor.id === targetId)!;
      assert.deepEqual(actor.ammoMagazine, {remaining: 0, capacity: ordinary.capacity});
      assert.equal(actor.reload!.startedAt, last.startedAt);
      assert.equal(actor.reload!.duration, last.duration);
    }
    evidence.emptyBeforeDeadlineKeys = emptyUntilDeadline.map(row => row.snapshot.tick);
    const firstRefill = frames[0].find(row => row.snapshot.serverTime >= oldDeadline
      && row.snapshot.players.find(actor => actor.id === targetId)?.ammoMagazine?.remaining === ordinary.capacity)!;
    const emptyTick = (evidence.emptyOrdinary as ReturnType<typeof capture>).snapshot.tick;
    evidence.refillTiming = {simulationSeconds: (firstRefill.snapshot.tick - emptyTick) * .05,
      serverSeconds: (firstRefill.snapshot.serverTime - last.startedAt) / 1000,
      wallSeconds: (firstRefill.wallTime - (evidence.emptyOrdinary as ReturnType<typeof capture>).wallTime) / 1000,
      firstRefillTick: firstRefill.snapshot.tick, firstRefillServerTime: firstRefill.snapshot.serverTime,
      deadlineOvershootMs: firstRefill.snapshot.serverTime - oldDeadline};
    assert.equal(fires().length, ordinary.capacity);
    evidence.defaultRefilled = capture();
    await input(1, true);
    await wait(() => fires().length === ordinary.capacity + 1
      && player(targetId).ammoMagazine?.remaining === ordinary.capacity - 1);
    await input(1);
    assert.equal(player(targetId).reload!.duration, ordinary.normalSeconds);
    evidence.normalShot = capture();
    const settleTick = latest().tick;
    await wait(() => latest().tick >= settleTick + 5);
    assert.deepEqual(player(targetId).ammoMagazine, {remaining: ordinary.capacity - 1, capacity: ordinary.capacity});
    assert.equal(fires().length, ordinary.capacity + 1);
    evidence.noSecondRefill = capture();
    const stock = await clients[1].callApi('Inventory', {}); assert(stock.isSucc);
    assert.equal(stock.res.records.find(row => row.instanceId === instanceId)!.ownedQuantity, 0);
    assert.equal(events[0].filter(event => event.type === 'ammoConsumed' && event.playerId === targetId).length, 0);
    assert.equal(events[0].filter(event => event.type === 'fire' && event.playerId === targetId && event.skillId === 2011).length, 0);
    evidence.stock = stock.res;
    const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
    const remote = new Map(frames[1].map(row => [key(row.snapshot), row.snapshot]));
    const common = frames[0].filter(row => remote.has(key(row.snapshot)));
    for (const row of common) assert.deepEqual(row.snapshot.players, remote.get(key(row.snapshot))!.players);
    assert(common.length > 100); evidence.commonKeys = common.map(row => key(row.snapshot));
    const coreTypes = new Set(['fire', 'itemUsed', 'skillStopped', 'ammoConsumed']);
    const core = (rows: MsgRoomEvent[]) => rows.filter(event => coreTypes.has(event.type)
      && (event.playerId === targetId || event.targetId === targetId));
    await wait(() => core(events[0]).length === core(events[1]).length);
    assert.deepEqual(core(events[0]), core(events[1]));
    evidence.coreEvents = core(events[0]); evidence.leave = [];
    for (const client of clients) {
      const leave = await client.callApi('Leave', {roomId: created.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(leave); assert(leave.isSucc);
    }
    evidence.status = 'PASS_LIMITED_EMPTY_ORDINARY_MAGAZINE_RECOMPUTE_DEADLINE_REFILL';
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
