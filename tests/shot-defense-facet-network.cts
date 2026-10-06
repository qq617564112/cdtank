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
import {recomputeRoleAttributes} from '../apps/server/src/battle/roles/recompute';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}

type ArmorFields = NonNullable<ReturnType<typeof recomputeQualifiedRoleArmor>>;

function expectedArmorDamage(rawAttack: number, fields: ArmorFields, correction: number): number {
  return rawAttack * 100 / (100 + Math.max(0, fields.defensePercent * 100 + fields.defenseBonus) * correction);
}

async function main(): Promise<void> {
  const port = Number(process.env.SHOT_DEFENSE_FACET_PORT);
  assert.equal(port, 3631);
  assert.equal(process.env.SHOT_DEFENSE_FACET_RELEASE, '1', 'Requires coordinated compiled release');
  const acceptedSource = 'recovery/output/reactive-armor-network-2026-10-05T22-31-16-125Z';
  const tail = process.env.SHOT_DEFENSE_FACET_TAIL === '1';
  const firstSource = 'recovery/output/shot-defense-facet-network-2026-10-05T22-44-49-462Z';
  const source = tail ? firstSource : acceptedSource;
  const identitySource = source;
  const accounts = JSON.parse(readFileSync(identitySource + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-shot-defense-facet-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/shot-defense-facet-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', fundsInjected: false, pointsInjected: false,
      ownedRecordsInjected: false, newBUY: false, sourceIdentity: identitySource + '-identity.private.json'},
    tail, reusedFirstRaw: tail ? firstSource + '.json' : undefined,
    simulationTickSeconds: .05,
    scope: 'Ordinary UNEQUIP17071, A/D target body turns, three peer2001 front/side/back hostile hits, dual states/Leave/native/sameDBrestart'};
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
  let server: ChildProcess | undefined, log = '';
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
      owned: await must<ServiceType['api']['OwnedRoles']['res']>(clients[i].callApi('OwnedRoles', {})),
      learning: await must<ServiceType['api']['PetSkillLearning']['res']>(clients[i].callApi('PetSkillLearning', {operation: 'QUERY'}))};
  }
  type AccountState = Awaited<ReturnType<typeof query>>;
  function originalFields(account: AccountState, player: MsgRoomSnapshot['players'][number]): ArmorFields {
    const view = new DataView(Uint8Array.from(account.equipment.profile.bytes).buffer);
    const equipment = new Map(account.owned.equipment.find(row => new Map(row.fields).get(0x1c) === view.getUint32(0xa8, true))!.fields);
    const gear = new Map(account.owned.base.find(row => new Map(row.fields).get(0) === view.getUint32(0xa4, true))!.fields);
    const tank = TANKS.find(row => row.id === equipment.get(0x24))!, pet = PET_BASES.find(row => row.id === gear.get(8))!;
    assert.equal(player.tankId, tank.id); assert.equal(player.petId, pet.id);
    assert.equal(account.equipment.decorationInstanceId, 0); assert.equal(account.equipment.markInstanceId, 0);
    for (const offset of [0x2c, 0x34, 0x3c]) assert(gear.has(offset), 'Complete selected base missing ' + offset);
    for (const offset of [0x34, 0x3c, 0x40, 0x4c, 0x50, 0x58, 0x5c, 0x60]) {
      assert(equipment.has(offset), 'Complete selected equipment missing ' + offset);
    }
    const input = {ownedField34: equipment.get(0x34),
      ownedAtk: equipment.get(0x3c), ownedAtkBonus: equipment.get(0x40),
      ownedDef: equipment.get(0x4c), ownedDefBonus: equipment.get(0x50), tank: tank.recomputeBase,
      tankType: tank.recomputeBase.tankType, pet, sources: {
        currentSkillIds: player.roleSkillSources!.currentSkillIds,
        equipmentSkills: Array.from({length: 6}, (_, slot) => ({baseId: gear.get(0x44 + slot * 4)!, rank: gear.get(0x5c + slot * 4)!})),
        extraSkill: {baseId: 0, rank: 0},
        itemIds: [0x58, 0x5c, 0x60].map(offset => equipment.get(offset)!).concat(account.equipment.slots
          .map(id => id ? account.inventory.records.find(row => row.instanceId === id)!.itemTableId : 0), [0, 0])},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0};
    const full = recomputeRoleAttributes({...input, base: {name: '', fields: gear},
      equipment: {name: '', fields: equipment}, movementScales: ROLE_INITIAL_MOVEMENT_SCALES, vip: 0, vipMultiplier: 0},
      {setMovement() {}, notify() {}, clearDirty() {}});
    assert.equal(full.completed, true, 'Complete source must reach original attribute completion');
    assert.equal(full.state.recordFields.get(0x58), player.maxHp);
    const sourceQualification = {playerId: player.id, completed: full.completed,
      recordFields: [...full.state.recordFields], roleIntegers: [...full.state.roleIntegers], roleFloats: [...full.state.roleFloats]};
    (evidence.sourceQualification as unknown[]).push(sourceQualification);
    const fields = recomputeQualifiedRoleArmor(input);
    assert(fields); assert.deepEqual(fields.selectedSkillIds, player.roleSkillSources!.selectedSkillIds);
    return fields;
  }
  function assertNative(final: AccountState[]): void {
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      evidence.native = accounts.map((account, ordinal) => {
        const profile = native.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(account.accountId)!;
        const data = {bytes: [...profile.payload as Uint8Array], strings: JSON.parse(String(profile.strings))};
        assert.deepEqual(data, final[ordinal].equipment.profile);
        const inventory = native.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id').all(account.accountId)
          .map(row => JSON.parse(String(row.record)));
        assert.deepEqual(inventory, final[ordinal].inventory.records);
        const owned: {base: unknown[]; equipment: unknown[]} = {base: [], equipment: []};
        for (const row of native.prepare('SELECT kind, record FROM role_records WHERE account_id=? ORDER BY instance_id').all(account.accountId)) {
          owned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)));
        }
        assert.deepEqual(owned, final[ordinal].owned);
        return {profile: data, inventory, owned};
      });
      const receipt = JSON.parse(String(native.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'reactive-buy-shield')!.receipt));
      const prior = JSON.parse(readFileSync(acceptedSource + '.json', 'utf8'));
      assert.deepEqual(receipt, prior.nativePurchaseReceipt); evidence.retainedPurchaseReceipt = receipt;
    } finally {native.close();}
  }
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  try {
    if (tail) {
      evidence.scope = 'Only first actual cold final full queries, native full records/retained receipt and explicit same-tempDB second server start';
      const first = JSON.parse(readFileSync(firstSource + '.json', 'utf8'));
      assert.equal(first.status, 'FAIL'); assert.equal(first.cleaned, true);
      const final = first.final as AccountState[];
      assert.equal(final.length, 2);
      await start(); await authenticate();
      const cold = [await query(0), await query(1)]; assert.deepEqual(cold, final);
      evidence.firstFinal = final; evidence.coldRestored = cold;
      assertNative(cold);
      for (const client of clients) await client.disconnect(); await stop();
      await start(); await authenticate();
      const restarted = [await query(0), await query(1)]; assert.deepEqual(restarted, cold);
      evidence.sameDatabaseRestart = restarted;
      evidence.status = 'PASS_FINITE_DIRECTIONAL_ARMOR_FIRST_FINAL_COLD_NATIVE_SAME_DATABASE_RESTART_SCOPE';
      return;
    }
    await start(); await authenticate();
    const before = [await query(0), await query(1)]; evidence.before = before;
    assert.equal(before[0].equipment.slotCount, 2);
    const shieldInstanceId = before[0].equipment.slots[1];
    assert(shieldInstanceId > 0);
    const shield = before[0].inventory.records.find(row => row.instanceId === shieldInstanceId)!;
    assert.equal(shield.itemTableId, 17071); assert.equal(shield.ownedQuantity, 1);
    assert.equal(before[0].learning.points, 0);
    const configured = await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {
      operation: 'UNEQUIP', target: 'PART', slot: 1}));
    assert.equal(configured.slots[1], 0); evidence.configured = configured;
    const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
      mode: 4, mapId: 7, roomName: '侧背装甲', name: 'FacetHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
    const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
      roomId: created.room.id, clientId: 'unused', name: 'FacetPeer', tankId: 3}));
    const roomId = created.room.id;
    const latest = (i = 0) => frames[i].at(-1)?.snapshot;
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
      && latest(i)?.players.length === 2));
    await wait(() => [0, 1].every(i => {
      const source = latest(i)?.players.find(p => p.id === created.playerId)?.roleSkillSources;
      return source !== undefined && !source.selectedSkillIds.includes(13161);
    }));
    evidence.afterUnequip = [latest(0), latest(1)];
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
    const player = (id: string) => latest()!.players.find(p => p.id === id)!;
    assert.equal(created.room.mode, 4); assert.notEqual(created.playerId, joined.playerId);
    assert.equal(created.room.mode <= 3 && player(created.playerId).team === player(joined.playerId).team, false);
    assert.equal(player(created.playerId).petId, 104);
    assert.equal(player(joined.playerId).ammoItemId, 2001);
    const sourceStates = [await query(0), await query(1)]; evidence.sourceStates = sourceStates;
    const targetFields = originalFields(sourceStates[0], player(created.playerId));
    const shooterFields = originalFields(sourceStates[1], player(joined.playerId));
    assert(!targetFields.selectedSkillIds.includes(13161));
    assert.equal(targetFields.defensePercent, 0.17000000178813934);
    assert.equal(targetFields.defenseBonus, 44);
    assert.equal(targetFields.sideDefensePercent, Math.fround(70 * Math.fround(.01)));
    assert.equal(targetFields.backDefensePercent, .5);
    evidence.armorSource = {shieldInstanceId, targetFields, shooterFields};
    const raw = Math.round(Math.max(0, shooterFields.attackBase * shooterFields.attackPercent + shooterFields.attackBonus));
    assert.equal(raw, 151);
    const sequences = [0, 0];
    async function input(i: number, turn = 0, aim = 0, fire = false): Promise<void> {
      assert((await clients[i].sendMsg('PlayerInput', {sequence: ++sequences[i], move: 0, turn,
        aim, fire, useItem: 0, clientTime: Date.now()})).isSucc);
    }
    let aimed = false;
    for (let n = 0; n < 240; n++) {
      const a = player(joined.playerId), b = player(created.playerId), desired = Math.atan2(b.x - a.x, b.z - a.z);
      const difference = Math.atan2(Math.sin(desired - a.yaw - a.aim), Math.cos(desired - a.yaw - a.aim));
      if (Math.abs(difference) < .025) {aimed = true; break;}
      await input(1, 0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aimed); await input(1);
    const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
    for (const [facet, offset] of [['FRONT', 0], ['SIDE', Math.PI / 2], ['BACK', Math.PI]] as const) {
      await wait(() => player(joined.playerId).reload?.remaining === 0);
      let oriented = false;
      for (let n = 0; n < 300; n++) {
        const target = player(created.playerId), attacker = player(joined.playerId);
        assert(typeof target.bodyYaw === 'number', 'Formal bodyYaw required');
        const incidence = Math.atan2(attacker.x - target.x, attacker.z - target.z);
        const difference = wrapped(incidence - offset - target.bodyYaw);
        if (Math.abs(difference) < .045) {oriented = true; break;}
        await input(0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert(oriented, 'Normal body turn must reach facet center'); await input(0);
      const settledTick = latest()!.tick; await wait(() => latest()!.tick >= settledTick + 3);
      const beforeShot = structuredClone(latest()!), target = player(created.playerId), attacker = player(joined.playerId);
      assert(typeof target.bodyYaw === 'number', 'Formal settled bodyYaw required');
      const bearing = {x: attacker.x - target.x, z: attacker.z - target.z};
      const angle = Math.abs(wrapped(Math.atan2(bearing.x, bearing.z) - target.bodyYaw));
      const actualFacet = angle <= Math.PI / 4 ? 'FRONT' : angle >= 3 * Math.PI / 4 ? 'BACK' : 'SIDE';
      assert.equal(actualFacet, facet);
      const correction = facet === 'FRONT' ? 1 : facet === 'SIDE' ? targetFields.sideDefensePercent : targetFields.backDefensePercent;
      const expectedDamage = expectedArmorDamage(raw, targetFields, correction);
      const hpBefore = target.hp, magazineBefore = attacker.ammoMagazine!.remaining;
      const expectedHP = Math.max(0, (hpBefore - expectedDamage) | 0);
      const indices = events.map(rows => rows.length);
      const hits = (i: number) => events[i].slice(indices[i]).filter(row => row.event.roomId === roomId
        && row.event.type === 'hit' && row.event.playerId === joined.playerId && row.event.targetId === created.playerId);
      await input(1, 0, 0, true); await wait(() => hits(0).length > 0 && hits(1).length > 0); await input(1);
      await wait(() => player(created.playerId).hp === expectedHP);
      const tick = latest()!.tick; await wait(() => latest()!.tick >= tick + 8);
      assert.equal(hits(0).length, 1); assert.equal(hits(1).length, 1);
      assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
      assert(Math.abs(hits(0)[0].event.value - expectedDamage) < 1e-8);
      assert.equal(player(joined.playerId).ammoMagazine!.remaining, magazineBefore - 1);
      assert.equal(player(created.playerId).hp, expectedHP);
      for (const i of [0, 1]) assert.equal(events[i].slice(indices[i]).filter(row => row.event.type === 'playerHealed').length, 0);
      (evidence.phases as unknown[]).push({facet, angle, bodyYaw: target.bodyYaw, bearing, correction,
        targetFields, shooterFields, raw, expectedDamage, hpBefore, expectedHP, beforeShot,
        afterShot: latest(), hit: hits(0)[0]});
    }
    assert.equal((evidence.phases as unknown[]).length, 3);
    for (const i of [0, 1]) assert.equal(events[i].filter(row => row.event.roomId === roomId
      && row.event.type === 'hit' && row.event.playerId === joined.playerId && row.event.targetId === created.playerId).length, 3);
    const peer = new Map(frames[1].filter(row => row.snapshot.roomId === roomId).map(row => [key(row.snapshot), row.snapshot]));
    const common = new Set<string>();
    for (const row of frames[0]) {
      if (row.snapshot.roomId !== roomId || row.snapshot.phase !== 'PLAYING') continue;
      const other = peer.get(key(row.snapshot)); if (other) {assert.deepEqual(row.snapshot, other); common.add(key(row.snapshot));}
    }
    assert(common.size > 4); evidence.commonUniqueFullSnapshots = common.size;
    for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    const final = [await query(0), await query(1)]; evidence.final = final;
    assert.deepEqual(final[1], before[1]);
    assert.deepEqual(final[0].owned, before[0].owned);
    assert.equal(final[0].learning.points, 0);
    const expectedProfile = structuredClone(before[0].equipment.profile);
    const bytes = Uint8Array.from(expectedProfile.bytes), view = new DataView(bytes.buffer);
    view.setUint32(0x148 + 4, 0, true); expectedProfile.bytes = [...bytes];
    assert.deepEqual(final[0].equipment.profile, expectedProfile);
    assert.deepEqual(final[0].learning.owned, before[0].learning.owned);
    const expectedInventory = structuredClone(before[0].inventory);
    expectedInventory.records.find(row => row.instanceId === shieldInstanceId)!.state = 0;
    assert.deepEqual(final[0].inventory, expectedInventory);
    assert.equal(final[0].inventory.records.find(row => row.instanceId === shieldInstanceId)!.ownedQuantity, 1);
    for (const client of clients) await client.disconnect(); await stop();
    assertNative(final);
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_DIRECTIONAL_ARMOR_ORDINARY_FRONT_SIDE_BACK_BODY_TURN_DUAL_STATE_NATIVE_RESTART_SCOPE';
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
