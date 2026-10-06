import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}

async function main(): Promise<void> {
  const port = Number(process.env.PERMANENT_BARREL_PORT);
  assert.equal(port, 3623);
  assert.equal(process.env.PERMANENT_BARREL_RELEASE, '1', 'Requires coordinated compiled release');
  const source = 'recovery/output/pet-part-slot-learning-network-2026-10-05T21-15-53-125Z';
  const accounts = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-permanent-barrel-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/permanent-barrel-attack-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port,
    fixture: {source: source + '-checkpoint.sqlite', fundsInjected: false, pointsInjected: false,
      ownedRecordsInjected: false}, phases: [], leaves: [], simulationTickSeconds: .05,
    policy: 'Math.round(Math.max(0, attackBase * attackPercent + attackBonus)); direct Web damage',
    scope: 'Normal BUY13001; two rooms, unmounted then WAITING EQUIP, accepted ordinary2001 hit, full dual snapshots/Leave/native/full same DB restart'};
  const clients = [0, 1].map(() => new WsClient<ServiceType>(serviceProto, {
    server: `ws://127.0.0.1:${port}`, logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: {event: MsgRoomEvent; wallTime: number; receivedAfterTick?: number}[][] = [[], []];
  clients.forEach((client, i) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[i].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {
      events[i].push({event, wallTime: Date.now(), receivedAfterTick: frames[i].at(-1)?.snapshot.tick});
    });
  });
  let server: ChildProcess | undefined, log = '', sequence = 0;
  async function wait(predicate: () => boolean, timeout = 20000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), 'Deadline: ' + log.slice(-1000));
  }
  async function start(): Promise<void> {
    const offset = log.length;
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(offset).includes(`Server started at ${port}.`));
  }
  async function stop(): Promise<void> {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve));
      server.kill(); await closed;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [i, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      await must(client.callApi('Account', {token: accounts[i].token}));
    }
  }
  async function query(i: number) {
    return {
      inventory: await must<ServiceType['api']['Inventory']['res']>(clients[i].callApi('Inventory', {})),
      equipment: await must<ServiceType['api']['Equipment']['res']>(clients[i].callApi('Equipment', {operation: 'QUERY'})),
      owned: await must<ServiceType['api']['OwnedRoles']['res']>(clients[i].callApi('OwnedRoles', {}))};
  }
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  try {
    await start(); await authenticate();
    const initial = await query(0);
    evidence.before = initial;
    const view = new DataView(Uint8Array.from(initial.equipment.profile.bytes).buffer);
    const tankInstance = view.getUint32(0xa8, true), petInstance = view.getUint32(0xa4, true);
    const equipmentFields = new Map(initial.owned.equipment.find(row => new Map(row.fields).get(0x1c) === tankInstance)!.fields);
    const petFields = new Map(initial.owned.base.find(row => new Map(row.fields).get(0) === petInstance)!.fields);
    const tank = TANKS.find(row => row.id === equipmentFields.get(0x24))!;
    const pet = PET_BASES.find(row => row.id === petFields.get(8))!;
    assert.equal(tank.id, 3); assert.equal(pet.id, 3);
    assert.equal(initial.equipment.slots[0], 0);
    assert.equal(initial.equipment.decorationInstanceId, 0); assert.equal(initial.equipment.markInstanceId, 0);
    assert.equal(combatSkills.get(13001)!.attributes.Atk, 20);
    assert.equal(combatSkills.get(13001)!.triggerType, 0);
    assert.equal(combatSkills.get(13001)!.functions[0].type, 1);
    assert.equal(combatSkills.get(13001)!.functions[0].t, 65535);
    const bought = await must<ServiceType['api']['Shop']['res']>(clients[0].callApi('Shop', {
      operation: 'BUY', itemTableId: 13001, quantity: 1, currency: 'MONEY', requestId: 'permanent_barrel_13001'}));
    const barrel = bought.purchased!;
    assert.equal(barrel.itemTableId, 13001); evidence.purchase = bought;
    const damageResults: number[] = [];
    for (const mounted of [false, true]) {
      const created: ServiceType['api']['CreateRoom']['res'] = await must(clients[0].callApi('CreateRoom', {
        mode: 4, mapId: 7, roomName: mounted ? '炮管装配' : '炮管基线', name: 'BarrelOwner',
        tankId: tank.id, minPlayers: 2, maxPlayers: 2}));
      const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
        roomId: created.room.id, clientId: 'unused', name: 'BarrelTarget', tankId: 1}));
      const roomId = created.room.id;
      await wait(() => frames.every(rows => rows.at(-1)?.snapshot.roomId === roomId
        && rows.at(-1)?.snapshot.phase === 'WAITING' && rows.at(-1)?.snapshot.players.length === 2));
      if (mounted) {
        await must(clients[0].callApi('Ready', {round: 1}));
        await wait(() => frames.every(rows => rows.at(-1)?.snapshot.roomId === roomId
          && rows.at(-1)?.snapshot.phase === 'WAITING'
          && rows.at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId) === true));
        evidence.beforeEquipReady = frames.map(rows => rows.at(-1)!.snapshot);
        const configured = await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {
          operation: 'EQUIP', target: 'PART', slot: 0, instanceId: barrel.instanceId}));
        assert.equal(configured.slots[0], barrel.instanceId); evidence.configured = configured;
        await wait(() => frames.every(rows => {
          const snapshot = rows.at(-1)?.snapshot;
          return snapshot?.roomId === roomId && snapshot.phase === 'WAITING'
            && !snapshot.match?.readyPlayerIds.includes(created.playerId)
            && snapshot.players.find(row => row.id === created.playerId)?.roleSkillSources?.selectedSkillIds.includes(13001) === true;
        }));
        evidence.afterEquipReadyReset = frames.map(rows => rows.at(-1)!.snapshot);
      }
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => frames.every(rows => rows.at(-1)?.snapshot.roomId === roomId
        && rows.at(-1)?.snapshot.phase === 'PLAYING'));
      const latest = () => frames[0].at(-1)!.snapshot;
      const shooter = (): MsgRoomSnapshot['players'][number] => latest().players.find(row => row.id === created.playerId)!;
      const target = () => latest().players.find(row => row.id === joined.playerId)!;
      const inventory = await must<ServiceType['api']['Inventory']['res']>(clients[0].callApi('Inventory', {}));
      const configured = await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {operation: 'QUERY'}));
      assert.equal(shooter().tankId, tank.id); assert.equal(shooter().petId, pet.id);
      assert.equal(shooter().roleSkillSources!.selectedSkillIds.includes(13001), mounted);
      const itemIds = [0x58, 0x5c, 0x60].map(offset => equipmentFields.get(offset)!)
        .concat(configured.slots.map(id => id ? inventory.records.find(row => row.instanceId === id)!.itemTableId : 0), [0, 0]);
      const qualified = recomputeQualifiedRoleArmor({
        ownedField34: equipmentFields.get(0x34), ownedAtk: equipmentFields.get(0x3c),
        ownedAtkBonus: equipmentFields.get(0x40), ownedDef: equipmentFields.get(0x4c),
        ownedDefBonus: equipmentFields.get(0x50), tank: tank.recomputeBase, tankType: tank.recomputeBase.tankType,
        pet, sources: {currentSkillIds: shooter().roleSkillSources!.currentSkillIds,
          equipmentSkills: Array.from({length: 6}, (_, slot) => ({baseId: petFields.get(0x44 + slot * 4)!,
            rank: petFields.get(0x5c + slot * 4)!})), extraSkill: {baseId: 0, rank: 0}, itemIds},
        skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0});
      assert(qualified);
      const expectedDamage = Math.round(Math.max(0, qualified.attackBase * qualified.attackPercent + qualified.attackBonus));
      assert(expectedDamage > 0 && target().hp > expectedDamage, 'One shot must leave the natural target alive');
      async function input(aim = 0, fire = false): Promise<void> {
        assert((await clients[0].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0,
          aim, fire, useItem: 0, clientTime: Date.now()})).isSucc);
      }
      let aimed = false;
      for (let n = 0; n < 240; n++) {
        const a = shooter(), b = target(), desired = Math.atan2(b.x - a.x, b.z - a.z);
        const difference = Math.atan2(Math.sin(desired - a.yaw - a.aim), Math.cos(desired - a.yaw - a.aim));
        if (Math.abs(difference) < .025) {aimed = true; break;}
        await input(Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert(aimed); await input();
      const beforeShot = structuredClone(latest()), hpBefore = target().hp;
      const indices = events.map(rows => rows.length);
      await input(0, true);
      const hits = (i: number) => events[i].slice(indices[i]).filter(row => row.event.roomId === roomId
        && row.event.type === 'hit' && row.event.playerId === created.playerId && row.event.targetId === joined.playerId);
      await wait(() => hits(0).length > 0 && hits(1).length > 0);
      await input();
      await wait(() => target().hp === hpBefore - expectedDamage);
      const tick = latest().tick; await wait(() => latest().tick >= tick + 8);
      assert.equal(hits(0).length, 1); assert.equal(hits(1).length, 1);
      assert.equal(hits(0)[0].event.value, expectedDamage);
      assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
      assert.equal(target().hp, hpBefore - expectedDamage);
      const peerFrames = new Map(frames[1].filter(row => row.snapshot.roomId === roomId)
        .map(row => [key(row.snapshot), row.snapshot]));
      let common = 0;
      for (const row of frames[0]) {
        if (row.snapshot.roomId !== roomId || row.snapshot.phase !== 'PLAYING') continue;
        const other = peerFrames.get(key(row.snapshot));
        if (other) {assert.deepEqual(row.snapshot, other); common++;}
      }
      assert(common > 4);
      (evidence.phases as unknown[]).push({mounted, qualified, expectedDamage, beforeShot,
        afterShot: latest(), hit: hits(0)[0], commonFullSnapshots: common});
      damageResults.push(expectedDamage);
      for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    }
    assert.equal(damageResults[1] - damageResults[0], 20);
    const final = [await query(0), await query(1)]; evidence.final = final;
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const stored = JSON.parse(String(native.prepare('SELECT record FROM inventory WHERE account_id=? AND instance_id=?')
        .get(accounts[0].accountId, barrel.instanceId)!.record));
      const {battleQuantity: queriedBattle, ...queriedRecord} = final[0].inventory.records.find(row => row.instanceId === barrel.instanceId)!;
      const {battleQuantity: storedBattle, ...storedRecord} = stored;
      assert.equal(storedBattle, 0); assert.equal(queriedBattle, 0);
      assert.deepEqual(storedRecord, queriedRecord);
      const profile = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(accounts[0].accountId)!;
      assert.deepEqual({bytes: [...profile.payload as Uint8Array], strings: JSON.parse(String(profile.strings))}, final[0].equipment.profile);
      const receipt = JSON.parse(String(native.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'permanent_barrel_13001')!.receipt));
      assert.deepEqual(receipt, barrel);
      evidence.native = {barrel: stored, storedBattle, queriedBattle, profile: final[0].equipment.profile, receipt};
    } finally {native.close();}
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final);
    evidence.restored = restored;
    evidence.status = 'PASS_FINITE_PERMANENT_BARREL_ATTACK_ORDINARY_SHOT_DUAL_STATE_LEAVE_RESTART_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect(); await stop();
    const saved = new DatabaseSync(database, {readOnly: true});
    try {await backup(saved, output + '-checkpoint.sqlite');} finally {saved.close();}
    writeFileSync(output + '-identity.private.json', JSON.stringify({accounts}), {mode: 0o600});
    evidence.frames = frames; evidence.events = events; evidence.checkpoint = output + '-checkpoint.sqlite';
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2)); writeFileSync(output + '-server.log', log);
    console.log(String(evidence.status) + ' ' + output + '.json');
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
