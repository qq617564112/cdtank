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
  const output = `recovery/output/tank-ammo-special-respawn-network-${stamp}`;
  const checkpoint = 'recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-special-respawn-'));
  const database = join(directory, 'accounts.sqlite');
  const port = 3587;
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
    scope: 'Real BUY3/pet2 checkpoint, normal BUY2011/Kitbag; ordinary injury, partial ordinary magazine, unspent special selection at natural death, natural respawn default recomputation and fresh ordinary fire. No live state injection, no burn/damage accuracy claim.',
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
    const ordinary = oracle(2001), special = oracle(2011);
    evidence.source = {tankFields: [...tankFields], petFields: [...petFields], ordinary, special,
      boundGear: 'unqualified; not substituted from selected pet',
      lifecycle: 'Rebuilt death/respawn default selection and computed magazine fill; original formula reused'};
    const bought = await clients[1].callApi('Shop', {operation: 'BUY', itemTableId: 2011,
      quantity: 1, currency: 'MONEY', requestId: 'ammo2011_special_respawn_first'});
    evidence.purchase = bought; assert(bought.isSucc);
    const instanceId = bought.res.purchased!.instanceId;
    const assigned = await clients[1].callApi('Kitbag', {operation: 'ASSIGN', slot: 1, instanceId});
    evidence.assignment = assigned; assert(assigned.isSucc);
    const created = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7,
      roomName: '特殊弹复活重算', name: 'Shooter', tankId: 3, minPlayers: 2, maxPlayers: 2});
    assert(created.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: created.res.room.id,
      clientId: 'ignored', name: 'Measured', tankId: 3}); assert(joined.isSucc);
    const shooterId = created.res.playerId, targetId = joined.res.playerId;
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    assert.equal(player(targetId).maxHp, petFields.get(0x2c));
    assert.deepEqual(player(targetId).ammoMagazine, {remaining: ordinary.capacity, capacity: ordinary.capacity});
    evidence.initial = capture();
    let aligned = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const shooter = player(shooterId), target = player(targetId);
      const desired = Math.atan2(target.x - shooter.x, target.z - shooter.z);
      const delta = Math.atan2(Math.sin(desired - shooter.yaw - shooter.aim),
        Math.cos(desired - shooter.yaw - shooter.aim));
      if (Math.abs(delta) < .02) {aligned = true; break;}
      await input(0, false, 0, Math.sign(delta));
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aligned); await input(0, true);
    const initialHp = player(targetId).hp;
    await wait(() => player(targetId).hp < initialHp && player(targetId).alive);
    const firstDamage = initialHp - player(targetId).hp;
    await wait(() => player(targetId).hp > 0 && player(targetId).hp <= firstDamage, 45000);
    await input(0);
    evidence.preInjury = capture();
    await input(1, true);
    await wait(() => player(targetId).ammoMagazine?.remaining === ordinary.capacity - 1);
    await input(1);
    const oldReload = {...player(targetId).reload!};
    assert.equal(oldReload.duration, ordinary.normalSeconds);
    assert(oldReload.startedAt > 0);
    evidence.partialOrdinary = capture(); evidence.oldReload = oldReload;
    await input(1, false, 2);
    await wait(() => player(targetId).ammoItemId === 2011);
    assert.equal(player(targetId).ammoMagazine!.capacity, special.capacity);
    assert.equal(player(targetId).ammoMagazine!.remaining, 1);
    evidence.unspentSelected = capture();
    await input(0, true);
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.players.find(row => row.id === targetId)?.alive === false));
    await input(0);
    assert.equal(player(targetId).ammoItemId, 2011);
    evidence.death = capture();
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.players.find(row => row.id === targetId)?.alive === true));
    const restored = player(targetId);
    assert.equal(restored.ammoItemId, 2001); assert.equal(restored.selectedAmmoSlot, 1);
    assert.deepEqual(restored.ammoMagazine, {remaining: ordinary.capacity, capacity: ordinary.capacity});
    assert.equal(restored.reload!.startedAt, 0); assert.equal(restored.reload!.duration, 0);
    assert.equal(restored.hp, restored.maxHp); assert.equal(restored.maxHp, petFields.get(0x2c));
    evidence.restored = capture();
    await input(1, true);
    await wait(() => player(targetId).ammoMagazine?.remaining === ordinary.capacity - 1);
    await input(1);
    assert.equal(player(targetId).reload!.duration, ordinary.normalSeconds);
    evidence.normalShot = capture();
    const stock = await clients[1].callApi('Inventory', {}); assert(stock.isSucc);
    assert.equal(stock.res.records.find(row => row.instanceId === instanceId)!.ownedQuantity, 1);
    assert.equal(events[0].filter(event => event.type === 'ammoConsumed' && event.playerId === targetId).length, 0);
    assert.equal(events[0].filter(event => event.type === 'fire' && event.playerId === targetId && event.skillId === 2011).length, 0);
    evidence.stock = stock.res;
    const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
    const remote = new Map(frames[1].map(row => [key(row.snapshot), row.snapshot]));
    const common = frames[0].filter(row => remote.has(key(row.snapshot)));
    for (const row of common) assert.deepEqual(row.snapshot.players, remote.get(key(row.snapshot))!.players);
    assert(common.length > 100); evidence.commonKeys = common.map(row => key(row.snapshot));
    const coreTypes = new Set(['fire', 'ammoConsumed', 'destroy', 'respawn']);
    const core = (rows: MsgRoomEvent[]) => rows.filter(event => coreTypes.has(event.type)
      && (event.playerId === targetId || event.targetId === targetId));
    await wait(() => core(events[0]).length === core(events[1]).length);
    assert.deepEqual(core(events[0]), core(events[1]));
    evidence.coreEvents = core(events[0]); evidence.leave = [];
    for (const client of clients) {
      const leave = await client.callApi('Leave', {roomId: created.res.room.id, round: 1});
      (evidence.leave as unknown[]).push(leave); assert(leave.isSucc);
    }
    evidence.status = 'PASS_LIMITED_SPECIAL_AMMO_RESPAWN_RECOMPUTATION';
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
