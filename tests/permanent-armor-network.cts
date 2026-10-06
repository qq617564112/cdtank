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

type ArmorFields = NonNullable<ReturnType<typeof recomputeQualifiedRoleArmor>>;

function expectedArmorDamage(rawAttack: number, fields: ArmorFields): number {
  return rawAttack * 100 / (100 + Math.max(0, fields.defensePercent * 100 + fields.defenseBonus));
}

async function main(): Promise<void> {
  const port = Number(process.env.PERMANENT_ARMOR_PORT);
  assert.equal(port, 3625);
  assert.equal(process.env.PERMANENT_ARMOR_RELEASE, '1', 'Requires coordinated compiled release');
  const source = 'recovery/output/permanent-barrel-attack-network-2026-10-05T21-38-35-170Z';
  const accounts = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-permanent-armor-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/permanent-armor-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, phases: [], leaves: [],
    fixture: {source: source + '-checkpoint.sqlite', fundsInjected: false, pointsInjected: false,
      ownedRecordsInjected: false, newBUY: false}, simulationTickSeconds: .05,
    scope: 'Normal UNEQUIP/EQUIP same14003; two2001 natural hit rooms, source/Ready reset, dual complete states, native and sameDBrestart'};
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
  type AccountState = Awaited<ReturnType<typeof query>>;
  function originalFields(account: AccountState, player: MsgRoomSnapshot['players'][number]): ArmorFields {
    const view = new DataView(Uint8Array.from(account.equipment.profile.bytes).buffer);
    const equipment = new Map(account.owned.equipment.find(row => new Map(row.fields).get(0x1c) === view.getUint32(0xa8, true))!.fields);
    const gear = new Map(account.owned.base.find(row => new Map(row.fields).get(0) === view.getUint32(0xa4, true))!.fields);
    const tank = TANKS.find(row => row.id === equipment.get(0x24))!, pet = PET_BASES.find(row => row.id === gear.get(8))!;
    assert.equal(player.tankId, tank.id); assert.equal(player.petId, pet.id);
    assert.equal(account.equipment.decorationInstanceId, 0); assert.equal(account.equipment.markInstanceId, 0);
    const fields = recomputeQualifiedRoleArmor({ownedField34: equipment.get(0x34),
      ownedAtk: equipment.get(0x3c), ownedAtkBonus: equipment.get(0x40),
      ownedDef: equipment.get(0x4c), ownedDefBonus: equipment.get(0x50), tank: tank.recomputeBase,
      tankType: tank.recomputeBase.tankType, pet, sources: {
        currentSkillIds: player.roleSkillSources!.currentSkillIds,
        equipmentSkills: Array.from({length: 6}, (_, slot) => ({baseId: gear.get(0x44 + slot * 4)!, rank: gear.get(0x5c + slot * 4)!})),
        extraSkill: {baseId: 0, rank: 0},
        itemIds: [0x58, 0x5c, 0x60].map(offset => equipment.get(offset)!).concat(account.equipment.slots
          .map(id => id ? account.inventory.records.find(row => row.instanceId === id)!.itemTableId : 0), [0, 0])},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0});
    assert(fields); assert.deepEqual(fields.selectedSkillIds, player.roleSkillSources!.selectedSkillIds);
    return fields;
  }
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  try {
    await start(); await authenticate();
    const before = [await query(0), await query(1)]; evidence.before = before;
    assert.equal(before[0].equipment.slots[2], 7);
    assert.equal(before[0].inventory.records.find(row => row.instanceId === 7)!.itemTableId, 14003);
    assert.equal(combatSkills.get(13033)!.attributes.Def, 15);
    assert.equal(combatSkills.get(13033)!.triggerType, 0);
    await must(clients[0].callApi('Equipment', {operation: 'UNEQUIP', target: 'PART', slot: 2}));
    const damageResults: number[] = [];
    for (const mounted of [false, true]) {
      const created: ServiceType['api']['CreateRoom']['res'] = await must(clients[0].callApi('CreateRoom', {
        mode: 4, mapId: 7, roomName: mounted ? '装甲装配' : '装甲基线', name: 'ArmorTarget',
        tankId: 3, minPlayers: 2, maxPlayers: 2}));
      const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
        roomId: created.room.id, clientId: 'unused', name: 'ArmorShooter', tankId: 3}));
      const roomId = created.room.id;
      await wait(() => frames.every(rows => rows.at(-1)?.snapshot.roomId === roomId
        && rows.at(-1)?.snapshot.phase === 'WAITING' && rows.at(-1)?.snapshot.players.length === 2));
      if (mounted) {
        await must(clients[0].callApi('Ready', {round: 1}));
        await wait(() => frames.every(rows => rows.at(-1)?.snapshot.roomId === roomId
          && rows.at(-1)?.snapshot.phase === 'WAITING'
          && rows.at(-1)?.snapshot.match?.readyPlayerIds.includes(created.playerId) === true));
        evidence.beforeEquipReady = frames.map(rows => rows.at(-1)!.snapshot);
        const configured = await must(clients[0].callApi('Equipment', {operation: 'EQUIP', target: 'PART', slot: 2, instanceId: 7}));
        assert.equal(configured.slots[2], 7); evidence.configured = configured;
        await wait(() => frames.every(rows => {
          const snapshot = rows.at(-1)?.snapshot;
          return snapshot?.roomId === roomId && snapshot.phase === 'WAITING'
            && !snapshot.match?.readyPlayerIds.includes(created.playerId)
            && snapshot.players.find(row => row.id === created.playerId)?.roleSkillSources?.selectedSkillIds.includes(13033) === true;
        }));
        evidence.afterEquipReadyReset = frames.map(rows => rows.at(-1)!.snapshot);
      }
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => frames.every(rows => rows.at(-1)?.snapshot.roomId === roomId && rows.at(-1)?.snapshot.phase === 'PLAYING'));
      const latest = () => frames[0].at(-1)!.snapshot;
      const shooter = (): MsgRoomSnapshot['players'][number] => latest().players.find(row => row.id === joined.playerId)!;
      const target = () => latest().players.find(row => row.id === created.playerId)!;
      const sourceStates = [await query(0), await query(1)];
      const attack = originalFields(sourceStates[1], shooter()), armor = originalFields(sourceStates[0], target());
      assert.equal(armor.selectedSkillIds.includes(13033), mounted);
      const rawAttack = Math.round(Math.max(0, attack.attackBase * attack.attackPercent + attack.attackBonus));
      assert.equal(rawAttack, 151);
      const expectedDamage = expectedArmorDamage(rawAttack, armor);
      assert(expectedDamage > 0 && target().hp > expectedDamage);
      assert.equal(target().defenseBoost, undefined);
      async function input(aim = 0, fire = false): Promise<void> {
        assert((await clients[1].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0,
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
      const beforeShot = structuredClone(latest()), hpBefore = target().hp, indices = events.map(rows => rows.length);
      const expectedHP = Math.max(0, (hpBefore - expectedDamage) | 0);
      await input(0, true);
      const hits = (i: number) => events[i].slice(indices[i]).filter(row => row.event.roomId === roomId
        && row.event.type === 'hit' && row.event.playerId === joined.playerId && row.event.targetId === created.playerId);
      await wait(() => hits(0).length > 0 && hits(1).length > 0); await input();
      await wait(() => target().hp === expectedHP);
      const tick = latest().tick; await wait(() => latest().tick >= tick + 8);
      assert.equal(hits(0).length, 1); assert.equal(hits(1).length, 1);
      assert(Math.abs(hits(0)[0].event.value - expectedDamage) < 1e-8);
      assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
      assert.equal(target().hp, expectedHP);
      const peer = new Map(frames[1].filter(row => row.snapshot.roomId === roomId).map(row => [key(row.snapshot), row.snapshot]));
      let common = 0;
      for (const row of frames[0]) {
        if (row.snapshot.roomId !== roomId || row.snapshot.phase !== 'PLAYING') continue;
        const other = peer.get(key(row.snapshot)); if (other) {assert.deepEqual(row.snapshot, other); common++;}
      }
      assert(common > 4);
      (evidence.phases as unknown[]).push({mounted, attack, armor, rawAttack, expectedDamage, expectedHP,
        sourceStates, beforeShot, afterShot: latest(), hit: hits(0)[0], commonFullSnapshots: common});
      damageResults.push(expectedDamage);
      for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    }
    assert(damageResults[1] < damageResults[0]);
    const final = [await query(0), await query(1)]; evidence.final = final;
    assert.deepEqual(final[0].equipment.profile, before[0].equipment.profile);
    assert.deepEqual(final[0].owned, before[0].owned);
    assert.deepEqual(final[1], before[1]);
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      evidence.native = accounts.map((account, ordinal) => {
        const profile = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(account.accountId)!;
        const data = {bytes: [...profile.payload as Uint8Array], strings: JSON.parse(String(profile.strings))};
        assert.deepEqual(data, final[ordinal].equipment.profile);
        const inventory = native.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id').all(account.accountId)
          .map(row => JSON.parse(String(row.record)));
        assert.deepEqual(inventory, final[ordinal].inventory.records);
        return {profile: data, inventory};
      });
    } finally {native.close();}
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_PERMANENT_ARMOR_ORDINARY_SHOT_READY_DUAL_STATE_NATIVE_RESTART_SCOPE';
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
