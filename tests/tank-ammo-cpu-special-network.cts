import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-cpu-special-')), port = 3267;
  let log = '';
  const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'),
      MATCH_TIME_LIMIT_SECONDS: '45'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {log += String(data);});
  server.stderr.on('data', data => {log += String(data);});
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {wallTime: number; snapshot: MsgRoomSnapshot}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
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
  function expected(itemId: number) {
    return recomputeRoleAmmo({tank: TANKS.find(tank => tank.id === 1)!.recomputeBase,
      sources: {currentSkillIds: combatItemSkills.get(itemId)!.skillIds,
        extraSkill: {baseId: 0, rank: 0}}, skills: combatSkills, items: combatItemSkills,
      limits: combatLimits, roleValue9: 0})!;
  }
  const ordinary = expected(2001), special = expected(2007);
  const evidence: Record<string, unknown> = {status: 'RUNNING', mode: 4, mapId: 7,
    ordinary, special,
    scope: 'Fresh actual Accounts without owned records; normal Cpu ADD/CONFIGURE supplies CPU-only temporary2007 stock1; autonomous selection/fire/exhaustion/default fallback and dual snapshots. No account imports or active state injection.'};
  try {
    await wait(() => log.includes(`Server started at ${port}.`));
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      assert((await client.callApi('Account', {})).isSucc);
      const owned = await client.callApi('OwnedRoles', {}); assert(owned.isSucc);
      assert.deepEqual(owned.res, {base: [], equipment: []});
      const stock = await client.callApi('Inventory', {}); assert(stock.isSucc);
      assert.deepEqual(stock.res.records, []);
    }
    const host = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '特殊弹规则',
      name: '普通房主', tankId: 1, minPlayers: 2, maxPlayers: 4}); assert(host.isSucc);
    assert((await clients[1].callApi('Join', {roomId: host.res.room.id, clientId: 'ignored',
      name: '正常目标', tankId: 1})).isSucc);
    const cpu = await clients[0].callApi('Cpu', {operation: 'ADD', round: 1, tankId: 1}); assert(cpu.isSucc);
    assert((await clients[0].callApi('Cpu', {operation: 'CONFIGURE', round: 1,
      playerId: cpu.res.playerId, loadout: [{slot: 2, itemTableId: 2007, quantity: 1}]})).isSucc);
    for (const client of clients) assert((await client.callApi('Ready', {round: 1})).isSucc);
    await wait(() => latest()?.phase === 'PLAYING');
    const id = cpu.res.playerId;
    const player = () => latest().players.find(player => player.id === id)!;
    assert.deepEqual(player().ammoMagazine, {remaining: ordinary.capacity, capacity: ordinary.capacity});
    assert.deepEqual(player().cpuLoadout, [{slot: 2, itemTableId: 2007, quantity: 1}]);
    evidence.initial = latest();
    await wait(() => events[0].some(event => event.type === 'ammoConsumed' && event.playerId === id), 18000);
    await wait(() => player().ammoItemId === 2007 && player().ammoMagazine?.remaining === 0);
    assert.equal(player().ammoMagazine!.capacity, special.capacity);
    assert.equal(player().cpuLoadout!.find(item => item.itemTableId === 2007)!.quantity, 0);
    assert.equal(player().reload!.source, 'original-normal');
    assert.equal(player().reload!.duration, special.lastBulletSeconds);
    evidence.afterSpecial = frames[0].at(-1);
    await wait(() => events[0].some(event => event.type === 'itemRejected' && event.playerId === id && event.skillId === 2007), 15000);
    await wait(() => frames[0].some(frame => frame.snapshot.players.some(player => player.id === id
      && player.ammoItemId === 2001 && player.ammoMagazine?.remaining === ordinary.capacity)));
    const returned = frames[0].find(frame => frame.snapshot.players.some(player => player.id === id
      && player.ammoItemId === 2001 && player.ammoMagazine?.remaining === ordinary.capacity)
      && frame.snapshot.tick > (evidence.afterSpecial as {snapshot: MsgRoomSnapshot}).snapshot.tick)!;
    assert(returned);
    evidence.returned = returned;
    await wait(() => player().ammoItemId === 2001 && player().ammoMagazine?.remaining === ordinary.capacity - 1);
    assert.equal(player().reload!.duration, ordinary.normalSeconds);
    evidence.afterDefaultFire = frames[0].at(-1);
    const consumed = events[0].filter(event => event.type === 'ammoConsumed' && event.playerId === id);
    assert.equal(consumed.length, 1);
    assert.equal(consumed[0].value, 0);
    for (const client of clients) {
      const stock = await client.callApi('Inventory', {}); assert(stock.isSucc);
      assert.deepEqual(stock.res.records, [], 'Temporary CPU stock must not create account inventory');
    }
    const common = frames[0].filter(a => a.snapshot.phase === 'PLAYING' && frames[1].some(b =>
      b.snapshot.roomId === a.snapshot.roomId && b.snapshot.tick === a.snapshot.tick
      && b.snapshot.phase === a.snapshot.phase));
    assert(common.length > 40);
    for (const a of common) {
      const b = frames[1].find(b => b.snapshot.roomId === a.snapshot.roomId
        && b.snapshot.tick === a.snapshot.tick && b.snapshot.phase === a.snapshot.phase)!;
      assert.deepEqual(a.snapshot.players, b.snapshot.players);
    }
    evidence.commonTicks = common.length;
    for (const client of clients) assert((await client.callApi('Leave', {roomId: host.res.room.id, round: 1})).isSucc);
    evidence.status = 'PASS_CPU_TEMPORARY_STOCK_SCOPE';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.error = String(error); throw error;
  } finally {
    for (const client of clients) await client.disconnect();
    if (server.exitCode === null) {
      const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.frames = frames; evidence.events = events; evidence.cleaned = true;
    writeFileSync(`recovery/output/tank-ammo-cpu-special-network-${stamp}.json`, JSON.stringify(evidence, null, 2));
    writeFileSync(`recovery/output/tank-ammo-cpu-special-network-${stamp}.log`, log);
  }
  console.log('PASS: normal CPU CONFIGURE2007, autonomous finite consumption/exhaustion/default return and ordinary magazine consumption with account isolation and dual synchronization');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
