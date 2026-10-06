import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {classifyItemId} from '../apps/shared/combat/item-hotkeys';
import {classifyInventoryCategory} from '../apps/shared/combat/inventory-query';
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

function expectedArmorDamage(rawAttack: number, fields: ArmorFields): number {
  return rawAttack * 100 / (100 + Math.max(0, fields.defensePercent * 100 + fields.defenseBonus));
}

async function main(): Promise<void> {
  const port = Number(process.env.REACTIVE_ARMOR_PORT);
  assert.equal(port, 3629);
  assert.equal(process.env.REACTIVE_ARMOR_RELEASE, '1', 'Requires coordinated compiled release');
  const source = 'recovery/output/browser-pet-life-drain-2026-10-05T22-20-27-738Z';
  const identitySource = 'recovery/output/shot-life-drain-network-2026-10-05T22-14-57-010Z';
  const accounts = JSON.parse(readFileSync(identitySource + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-reactive-armor-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/reactive-armor-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', fundsInjected: false, pointsInjected: false,
      ownedRecordsInjected: false, newBUY: true, sourceIdentity: identitySource + '-identity.private.json'},
    simulationTickSeconds: .05,
    scope: 'Ordinary BUY17071/EQUIPslot1, Ready source reset, two hostile peer2001 shots first hit0/no score then ordinary damage, dual states/Leave/native/coldrestart'};
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
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  try {
    await start(); await authenticate();
    const before = [await query(0), await query(1)]; evidence.before = before;
    assert.equal(before[0].equipment.slotCount, 2); assert.equal(before[0].equipment.slots[1], 0);
    assert.equal(before[0].learning.points, 0);
    const sourceSkill = combatSkills.get(13161)!;
    assert.equal(sourceSkill.attributes.MaxCounter, 1); assert.equal(sourceSkill.attributes.ItemMove, -2);
    assert.equal(sourceSkill.triggerType, 0);
    assert(sourceSkill.functions.some(fn => fn.type === 1 && fn.t === 0xffff));
    const queryShop = await must<ServiceType['api']['Shop']['res']>(clients[0].callApi('Shop', {operation: 'QUERY'}));
    const product = queryShop.items.find(row => row.itemTableId === 17071)!;
    assert(product); assert.equal(product.moneyPrice, 1500);
    const purchase = await must<ServiceType['api']['Shop']['res']>(clients[0].callApi('Shop', {
      operation: 'BUY', itemTableId: 17071, quantity: 1, currency: 'MONEY', requestId: 'reactive-buy-shield'}));
    evidence.purchase = purchase;
    assert(purchase.purchased); const shieldInstanceId = purchase.purchased.instanceId;
    assert.equal(purchase.purchased.itemTableId, 17071);
    assert.equal(classifyItemId(purchase.purchased.itemTableId), 12);
    assert.equal(classifyInventoryCategory(purchase.purchased.itemTableId), 5);
    assert.equal(purchase.purchased.ownedQuantity, 1, 'Existing purchase raw1 is a minute, not cancellation count');
    assert.equal(purchase.money, new DataView(Uint8Array.from(before[0].equipment.profile.bytes).buffer).getUint32(0x70, true) - 1500);
    const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
      mode: 4, mapId: 7, roomName: '反应装甲', name: 'ShieldHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
    const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
      roomId: created.room.id, clientId: 'unused', name: 'ShieldPeer', tankId: 3}));
    const roomId = created.room.id;
    const latest = (i = 0) => frames[i].at(-1)?.snapshot;
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
      && latest(i)?.players.length === 2));
    await must(clients[0].callApi('Ready', {round: 1}));
    await wait(() => [0, 1].every(i => latest(i)?.match?.readyPlayerIds.includes(created.playerId) === true));
    evidence.beforeEquip = [await query(0), latest(0), latest(1)];
    const configured = await must<ServiceType['api']['Equipment']['res']>(clients[0].callApi('Equipment', {
      operation: 'EQUIP', target: 'PART', slot: 1, instanceId: shieldInstanceId}));
    assert.equal(configured.slots[1], shieldInstanceId); evidence.configured = configured;
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
      && !latest(i)?.match?.readyPlayerIds.includes(created.playerId)
      && latest(i)?.players.find(p => p.id === created.playerId)?.roleSkillSources?.selectedSkillIds.includes(13161)));
    evidence.afterEquip = [latest(0), latest(1)];
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
    assert(targetFields.selectedSkillIds.includes(13161));
    let maximum = 0;
    for (const id of targetFields.selectedSkillIds) {
      const skill = combatSkills.get(id)!;
      const difference = (0 - skill.functions[0].z) | 0;
      const multiplier = skill.triggerType === 14 && difference > 0 ? difference : 1;
      maximum = (maximum + Math.imul(skill.attributes.MaxCounter, multiplier)) | 0;
    }
    const limit = combatLimits.get(20)!;
    maximum = Math.max(limit.lower, Math.min(limit.upper, maximum));
    assert.equal(maximum, 1);
    const targetQualification = (evidence.sourceQualification as {playerId: string; completed: boolean; roleIntegers: [number, number][]}[])
      .find(row => row.playerId === created.playerId)!;
    assert.equal(targetQualification.completed, true);
    assert.equal(new Map(targetQualification.roleIntegers).get(0x58), maximum);
    evidence.counterSource = {shieldInstanceId, maximum, limit, targetFields, shooterFields};
    const raw = Math.round(Math.max(0, shooterFields.attackBase * shooterFields.attackPercent + shooterFields.attackBonus));
    const expectedDamage = expectedArmorDamage(raw, targetFields);
    assert.equal(raw, 151); assert(expectedDamage > 0);
    async function input(aim = 0, fire = false): Promise<void> {
      assert((await clients[1].sendMsg('PlayerInput', {sequence: ++sequence, move: 0, turn: 0,
        aim, fire, useItem: 0, clientTime: Date.now()})).isSucc);
    }
    let aimed = false;
    for (let n = 0; n < 240; n++) {
      const a = player(joined.playerId), b = player(created.playerId), desired = Math.atan2(b.x - a.x, b.z - a.z);
      const difference = Math.atan2(Math.sin(desired - a.yaw - a.aim), Math.cos(desired - a.yaw - a.aim));
      if (Math.abs(difference) < .025) {aimed = true; break;}
      await input(Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert(aimed); await input();
    for (const blocked of [true, false]) {
      if (!blocked) await wait(() => player(joined.playerId).reload?.remaining === 0);
      const beforeShot = structuredClone(latest()!), hpBefore = player(created.playerId).hp;
      const scoreBefore = player(joined.playerId).score;
      const magazineBefore = player(joined.playerId).ammoMagazine!.remaining;
      const indices = events.map(rows => rows.length);
      const hits = (i: number) => events[i].slice(indices[i]).filter(row => row.event.roomId === roomId
        && row.event.type === 'hit' && row.event.playerId === joined.playerId && row.event.targetId === created.playerId);
      await input(0, true); await wait(() => hits(0).length > 0 && hits(1).length > 0); await input();
      const expectedHP = blocked ? hpBefore : Math.max(0, (hpBefore - expectedDamage) | 0);
      await wait(() => player(created.playerId).hp === expectedHP);
      const tick = latest()!.tick; await wait(() => latest()!.tick >= tick + 8);
      assert.equal(hits(0).length, 1); assert.equal(hits(1).length, 1);
      assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
      assert(Math.abs(hits(0)[0].event.value - (blocked ? 0 : expectedDamage)) < 1e-8);
      assert.equal(player(joined.playerId).ammoMagazine!.remaining, magazineBefore - 1);
      if (blocked) {
        assert.equal(player(joined.playerId).score, scoreBefore);
        assert.equal(hits(0)[0].event.hurtSelector, undefined);
        assert.equal(hits(0)[0].event.skillId, undefined);
      }
      else assert(player(joined.playerId).score > scoreBefore);
      assert.equal(player(created.playerId).hp, expectedHP);
      assert.equal(events[0].slice(indices[0]).filter(row => row.event.type === 'playerHealed').length, 0);
      assert.equal(events[1].slice(indices[1]).filter(row => row.event.type === 'playerHealed').length, 0);
      (evidence.phases as unknown[]).push({blocked, raw, expectedDamage: blocked ? 0 : expectedDamage,
        hpBefore, expectedHP, scoreBefore, beforeShot, afterShot: latest(), hit: hits(0)[0]});
    }
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
    view.setUint32(0x70, view.getUint32(0x70, true) - 1500, true);
    view.setUint32(0x148 + 4, shieldInstanceId, true); expectedProfile.bytes = [...bytes];
    assert.deepEqual(final[0].equipment.profile, expectedProfile);
    assert.deepEqual(final[0].learning.owned, before[0].learning.owned);
    const shield = final[0].inventory.records.find(row => row.instanceId === shieldInstanceId)!;
    assert.equal(shield.itemTableId, 17071); assert.equal(shield.ownedQuantity, 1); assert.equal(shield.battleQuantity, 0);
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
        const owned: {base: unknown[]; equipment: unknown[]} = {base: [], equipment: []};
        for (const row of native.prepare('SELECT kind, record FROM role_records WHERE account_id=? ORDER BY instance_id').all(account.accountId)) {
          owned[row.kind === 'base' ? 'base' : 'equipment'].push(JSON.parse(String(row.record)));
        }
        assert.deepEqual(owned, final[ordinal].owned);
        return {profile: data, inventory, owned};
      });
      const receipt = JSON.parse(String(native.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'reactive-buy-shield')!.receipt));
      assert.deepEqual(receipt, purchase.purchased); evidence.nativePurchaseReceipt = receipt;
    } finally {native.close();}
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_ORDINARY_REACTIVE_ARMOR17071_FIRST_BLOCK_SECOND_DAMAGE_READY_DUAL_STATE_NATIVE_RESTART_SCOPE';
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
