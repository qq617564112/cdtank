import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {classifyItemId, resolveItemHotkey} from '../apps/shared/combat/item-hotkeys';
import {classifyInventoryCategory} from '../apps/shared/combat/inventory-query';
import {TANKS, PET_BASES, MAPS} from '../apps/server/src/config';
import {combatCatalog, combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAttributes} from '../apps/server/src/battle/roles/recompute';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}

type ArmorFields = NonNullable<ReturnType<typeof recomputeQualifiedRoleArmor>>;

async function main(): Promise<void> {
  const item = combatCatalog.items.find(row => row.itemTableId === 3002)!;
  assert.equal(classifyInventoryCategory(3002), 2); assert.equal(classifyItemId(3002), 4);
  assert.equal(item.moneyPrice, 20); assert.equal(item.itemType, 4); assert.equal(item.battleUseMax, 10);
  assert.deepEqual(item.skillIds, [3002, 0, 0]);
  const placement = combatSkills.get(3002)!, damageSkill = combatSkills.get(4023)!;
  assert.equal(placement.triggerType, 1); assert.equal(placement.target, 4);
  assert.deepEqual(placement.functions[0], {type: 12, t: 30, x: 30, y: 4023, z: 3002});
  assert.equal(damageSkill.target, 1); assert.equal(damageSkill.range, 80);
  assert.equal(damageSkill.functions[0].type, 2); assert.equal(damageSkill.attributes.HP, -300);
  const port = Number(process.env.CONTACT_MINE_PORT);
  assert.equal(port, 3666); assert.equal(process.env.CONTACT_MINE_RELEASE, '1');
  const source = 'recovery/output/browser-pet-copy-skill-2026-10-06T01-49-31-259Z';
  const sourceRaw = JSON.parse(readFileSync(source + '.json', 'utf8'));
  assert.equal(sourceRaw.status, 'PASS_FINITE_REFERENCED_PET102_COPY240_LIFE_CLEAR_NEW_ROOM_FOOD200_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE');
  const sourceReview = JSON.parse(readFileSync('recovery/output/pet-copy-skill-root-review.json', 'utf8'));
  assert.equal(sourceReview.status, 'PASS_FINITE_ORDINARY_BUY_PET102_PET103_LEARN10711_HOSTILE_COPY10811_FOOD200_240_PER_LIFE_CLEAR200_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE');
  const accounts = JSON.parse(readFileSync(source + '-checkpoint-fixture.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-contact-mine-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const retainedDatabase = new DatabaseSync(database, {readOnly: true});
  const retainedReceipts = ['pet_purchases', 'shop_purchases', 'pet_skill_learning'].map(table => ({table,
    rows: retainedDatabase.prepare(`SELECT * FROM ${table} ORDER BY account_id,request_id`).all()}));
  retainedDatabase.close();
  const output = 'recovery/output/contact-mine-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, retainedReceipts, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', sourceIdentity: source + '-checkpoint-fixture.json',
      fundsInjected: false, ownedRecordsInjected: false, pointsInjected: false}, simulationTickSeconds: .05,
    policy: {durationSeconds: 30, triggerRadius: 30, geometry: 'XZ inclusive circle', directHPDelta: -300,
      expireBeforeContact: true, criticalFacetDrinkCounterDrainApplied: false,
      originalRange80ConsumerRecovered: false},
    scope: 'Normal BUY3002x2/Kitbag1/place once, owner retreat/peer natural contact/directHP300, full dual/native/restart, remaining1 for webpage'};
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
        const hotkeys = Array(7).fill(0) as number[];
        for (const row of native.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id=? ORDER BY slot').all(account.accountId)) {
          hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
        }
        assert.deepEqual(hotkeys, final[ordinal].inventory.hotkeys);
        return {profile: data, inventory, owned, hotkeys};
      });
      const receipt = JSON.parse(String(native.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?')
        .get(accounts[0].accountId, 'contact-mine-buy2')!.receipt));
      assert.deepEqual(receipt, (evidence.purchase as ServiceType['api']['Shop']['res']).purchased);
      evidence.nativePurchaseReceipt = receipt;
      for (const retained of retainedReceipts) {
        const rows = native.prepare(`SELECT * FROM ${retained.table} ORDER BY account_id,request_id`).all()
          .filter(row => !(retained.table === 'shop_purchases' && row.account_id === accounts[0].accountId
            && row.request_id === 'contact-mine-buy2'));
        assert.deepEqual(rows, retained.rows);
      }
    } finally {native.close();}
  }
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  const latest = (i = 0) => frames[i].at(-1)?.snapshot;
  const sequences = [0, 0];
  async function input(i: number, move = 0, turn = 0, useItem = 0): Promise<void> {
    const message = {sequence: ++sequences[i], move, turn, aim: 0, fire: false, useItem, clientTime: Date.now()};
    assert((await clients[i].sendMsg('PlayerInput', message)).isSucc);
    ((evidence.inputs ??= []) as unknown[]).push({ordinal: i, observedTick: latest()?.tick, message});
  }
  async function dual(snapshot: MsgRoomSnapshot) {
    await wait(() => frames[1].some(row => key(row.snapshot) === key(snapshot)));
    const pair = frames.map(rows => rows.find(row => key(row.snapshot) === key(snapshot))!);
    assert.deepEqual(pair[0].snapshot, pair[1].snapshot); return structuredClone(pair);
  }
  const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
  try {
    await start(); await authenticate();
    const initial = [await query(0), await query(1)]; evidence.initial = initial;
    assert.deepEqual(initial, sourceRaw.coldAfterRestart);
    const before = initial; evidence.before = before;
    assert.equal(before[0].learning.points, 0); assert.equal(before[1].learning.points, 0);
    assert(!before[0].inventory.records.some(row => row.itemTableId === 3002));
    evidence.sweepScope = 'No sweep transaction; root engineering owns sweep lifecycle';
    const beforeView = new DataView(Uint8Array.from(before[0].equipment.profile.bytes).buffer);
    assert.equal(beforeView.getUint32(0x70, true), 62860);
    assert.equal(before[0].inventory.records.find(row => row.instanceId === 18)!.ownedQuantity, 0);
    const purchase: ServiceType['api']['Shop']['res'] = await must<ServiceType['api']['Shop']['res']>(clients[0].callApi('Shop', {
      operation: 'BUY', itemTableId: 3002, quantity: 2, currency: 'MONEY', requestId: 'contact-mine-buy2'}));
    assert(purchase.purchased); evidence.purchase = purchase;
    assert.equal(purchase.money, beforeView.getUint32(0x70, true) - item.moneyPrice! * 2);
    assert.equal(purchase.purchased.itemTableId, 3002); assert.equal(purchase.purchased.ownedQuantity, 2);
    const instanceId = purchase.purchased.instanceId;
    const expectedHotkeys = [...before[0].inventory.hotkeys]; expectedHotkeys[0] = instanceId;
    evidence.expectedHotkeys = expectedHotkeys;
    const afterPurchase: AccountState[] = [await query(0), await query(1)]; evidence.afterPurchase = afterPurchase;
    const assignment: ServiceType['api']['Kitbag']['res'] = await must<ServiceType['api']['Kitbag']['res']>(clients[0].callApi('Kitbag', {
      operation: 'ASSIGN', slot: 1, instanceId}));
    assert.deepEqual(assignment.hotkeys, expectedHotkeys); evidence.assignment = assignment;
    const assigned = [await query(0), await query(1)]; evidence.assigned = assigned;
    assert.deepEqual(assigned[0].inventory.hotkeys, expectedHotkeys);
    assert.deepEqual(assigned[1], before[1]);
    assert.deepEqual(assigned[0].owned, before[0].owned);
    const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
      mode: 4, mapId: 7, roomName: '接触地雷', name: 'MineHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
    const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
      roomId: created.room.id, clientId: 'unused', name: 'MinePeer', tankId: 3}));
    const roomId = created.room.id;
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
      && latest(i)?.players.length === 2));
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
    const player = (id: string) => latest()!.players.find(p => p.id === id)!;
    const owner = () => player(created.playerId), target = () => player(joined.playerId);
    assert.notEqual(created.playerId, joined.playerId); assert.equal(created.room.mode <= 3 && owner().team === target().team, false);
    const sourceStates = [await query(0), await query(1)]; evidence.sourceStates = sourceStates;
    const hotkeyCommand = resolveItemHotkey(2, true, sourceStates[0].inventory.hotkeys, sourceStates[0].inventory.records);
    assert.deepEqual(hotkeyCommand, {accepted: true, command: {kind: 'placeTrap', instanceId}});
    evidence.hotkeyCommand = hotkeyCommand;
    const ownerFields = originalFields(sourceStates[0], owner()), targetFields = originalFields(sourceStates[1], target());
    evidence.armorSourcesRetainedButNotAppliedToDirectHP = {ownerFields, targetFields};
    async function face(ordinal: number, participant: () => MsgRoomSnapshot['players'][number], x: number, z: number) {
      let oriented = false;
      try {
        for (let n = 0; n < 300; n++) {
          const actor = participant(); assert(typeof actor.bodyYaw === 'number');
          const difference = wrapped(Math.atan2(x - actor.x, z - actor.z) - actor.bodyYaw!);
          if (Math.abs(difference) < .03) {oriented = true; break;}
          await input(ordinal, 0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
        }
      } finally {await input(ordinal);}
      assert(oriented, 'Normal body turn reaches target direction');
    }
    await face(0, owner, target().x, target().z);
    const beforePlace = structuredClone(latest()!), hpOwner = owner().hp, hpTarget = target().hp;
    assert(owner().alive && target().alive); assert.equal(hpOwner, owner().maxHp); assert.equal(hpTarget, target().maxHp);
    const starts = events.map(rows => rows.length), placeWall = Date.now();
    const core = (i: number) => events[i].slice(starts[i]).filter(row => row.event.roomId === roomId);
    const placed = (i: number) => core(i).filter(row => row.event.type === 'trapPlaced' && row.event.playerId === created.playerId);
    try {
      await input(0, 0, 0, 2);
      await wait(() => placed(0).length > 0 && placed(1).length > 0
        && latest()!.match?.groundTraps?.some(trap => trap.itemTableId === 3002) === true);
    } finally {await input(0);}
    assert.equal(placed(0).length, 1); assert.deepEqual(placed(0)[0].event, placed(1)[0].event);
    const placementFrame = structuredClone(latest()!), mine = placementFrame.match!.groundTraps!.find(trap => trap.itemTableId === 3002)!;
    assert.equal(mine.ownerId, created.playerId); assert.equal(mine.modelId, 3002); assert.equal(mine.id, placed(0)[0].event.targetId);
    assert.equal(Math.round(mine.x * 100) / 100, owner().x);
    assert.equal(Math.round(mine.z * 100) / 100, owner().z);
    assert.equal(mine.x, placed(0)[0].event.x); assert.equal(mine.y, placed(0)[0].event.y);
    assert.equal(mine.z, placed(0)[0].event.z);
    assert(mine.expiresAt - placementFrame.serverTime >= 29900 && mine.expiresAt - placementFrame.serverTime <= 30000);
    assert.equal(placed(0)[0].event.skillId, 3002);
    assert.deepEqual(placed(0)[0].event.playSkillEffect,
      {skillId: 3002, effectIndex: 0, duration: 0, roleId: Number(created.playerId.slice(1)), xBits: 0, zBits: 0});
    const playingStock = await query(0); evidence.playingStock = playingStock;
    const usedRecord = playingStock.inventory.records.find(row => row.instanceId === instanceId)!;
    assert.equal(usedRecord.ownedQuantity, 1); assert.equal(usedRecord.battleQuantity, 1);
    const distance = (actor: MsgRoomSnapshot['players'][number]) => Math.hypot(actor.x - mine.x, actor.z - mine.z);
    const retreatBefore = structuredClone(latest()!);
    try {await input(0, -1); await wait(() => distance(owner()) >= 90, 6000);}
    finally {await input(0);}
    evidence.ownerRetreat = {before: retreatBefore, after: await dual(structuredClone(latest()!)), distance: distance(owner())};
    await face(1, target, mine.x, mine.z);
    const beforeContact = structuredClone(latest()!);
    assert.equal(target().hp, hpTarget); assert.equal(owner().hp, hpOwner);
    const contact = (i: number) => core(i).filter(row => row.event.type === 'trapTriggered' && row.event.skillId === 4023);
    const hits = (i: number) => core(i).filter(row => row.event.type === 'hit' && row.event.skillId === 4023);
    const moveWall = Date.now();
    try {
      await input(1, 1);
      await wait(() => contact(0).length === 1 && contact(1).length === 1 && hits(0).length === 1 && hits(1).length === 1
        && target().hp === Math.max(0, (hpTarget + damageSkill.attributes.HP!) | 0), 15000);
    } finally {await input(1);}
    const afterContact = structuredClone(latest()!);
    assert.deepEqual(contact(0)[0].event, contact(1)[0].event); assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
    assert(afterContact.serverTime < mine.expiresAt);
    assert.equal(afterContact.match!.groundTraps!.some(trap => trap.id === mine.id), false);
    const hit = hits(0)[0].event;
    assert.equal(hit.playerId, created.playerId); assert.equal(hit.targetId, joined.playerId);
    assert.equal(hit.value, -damageSkill.attributes.HP!); assert.equal(hit.shotPlayerResult, undefined);
    assert(Math.hypot(hit.x - mine.x, hit.z - mine.z) <= placement.functions[0].x);
    assert.equal(contact(0)[0].event.targetId, joined.playerId);
    const attached = core(0).filter(row => row.event.playSkillEffect?.skillId === 4023);
    assert.equal(attached.length, 1); assert.deepEqual(attached[0].event.playSkillEffect,
      {skillId: 4023, effectIndex: 0, duration: 0, roleId: Number(joined.playerId.slice(1)), xBits: 0, zBits: 0});
    assert.equal(owner().hp, hpOwner); assert.equal(owner().score,
      beforePlace.players.find(p => p.id === created.playerId)!.score + MAPS.find(row => row.mode === 4 && row.mapId === 7)!.hitScore);
    assert.equal(target().deaths, beforePlace.players.find(p => p.id === joined.playerId)!.deaths);
    const hitFrame = frames[0].find(row => row.snapshot.roomId === roomId && row.snapshot.tick >= placementFrame.tick
      && row.snapshot.players.find(p => p.id === joined.playerId)!.hp !== hpTarget)!;
    assert(hitFrame);
    for (const row of frames[0].filter(row => row.snapshot.roomId === roomId && row.snapshot.tick >= placementFrame.tick
      && row.snapshot.tick < hitFrame.snapshot.tick)) {
      assert.equal(row.snapshot.players.find(p => p.id === joined.playerId)!.hp, hpTarget);
      assert(row.snapshot.match!.groundTraps!.some(trap => trap.id === mine.id));
    }
    const stableTick = latest()!.tick; await wait(() => latest()!.tick >= stableTick + 5);
    assert.equal(contact(0).length, 1); assert.equal(contact(1).length, 1);
    assert.equal(hits(0).length, 1); assert.equal(hits(1).length, 1);
    assert.equal(core(0).filter(row => row.event.type === 'itemUsed' && row.event.skillId === 3002).length, 1);
    assert.equal(core(0).filter(row => ['playerHealed', 'fire', 'destroy'].includes(row.event.type)).length, 0);
    const relevant = (i: number) => core(i).filter(row => ['itemUsed', 'trapPlaced', 'trapTriggered', 'hit', 'playerHealed'].includes(row.event.type));
    await wait(() => relevant(0).length === relevant(1).length); assert.deepEqual(relevant(0).map(row => row.event), relevant(1).map(row => row.event));
    const remote = new Map(frames[1].filter(row => row.snapshot.roomId === roomId).map(row => [key(row.snapshot), row.snapshot]));
    const common = new Set<string>();
    for (const row of frames[0].filter(row => row.snapshot.roomId === roomId)) {
      const peer = remote.get(key(row.snapshot)); if (peer) {assert.deepEqual(row.snapshot, peer); common.add(key(row.snapshot));}
    }
    assert(common.size > 20);
    const timing = {simulationSeconds: (hitFrame.snapshot.tick - placementFrame.tick) * .05,
      serverMilliseconds: hitFrame.snapshot.serverTime - placementFrame.serverTime,
      wallMilliseconds: hits(0)[0].wallTime - placeWall, peerMovementWallMilliseconds: hits(0)[0].wallTime - moveWall};
    assert(timing.serverMilliseconds < placement.functions[0].t * 1000);
    evidence.placement = {beforePlace, placementFrame, dual: await dual(placementFrame), mine, event: placed(0)[0]};
    evidence.contact = {beforeContact, afterContact, dual: await dual(afterContact), hitFrame: await dual(hitFrame.snapshot),
      event: contact(0)[0], hit: hits(0)[0], timing, hitDistance: Math.hypot(hit.x - mine.x, hit.z - mine.z),
      hpTargetBefore: hpTarget, hpTargetAfter: target().hp, ownerHpUnchanged: owner().hp, commonUniqueFullSnapshots: common.size};
    evidence.coreEvents = relevant(0);
    for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    const final = [await query(0), await query(1)]; evidence.final = final;
    assert.deepEqual(final[1], before[1]); assert.deepEqual(final[0].owned, before[0].owned);
    assert.deepEqual(final[0].learning, afterPurchase[0].learning);
    const expectedInventory = {...assigned[0].inventory, hotkeys: expectedHotkeys,
      records: assigned[0].inventory.records.map(row => row.instanceId === instanceId ? {...row, ownedQuantity: 1, battleQuantity: 0} : row)};
    assert.deepEqual(final[0].inventory, expectedInventory); assert.equal(final[0].inventory.hotkeys[0], instanceId);
    const profileBytes = Uint8Array.from(before[0].equipment.profile.bytes);
    new DataView(profileBytes.buffer).setUint32(0x70, beforeView.getUint32(0x70, true) - 40, true);
    const profile = {bytes: [...profileBytes], strings: before[0].equipment.profile.strings};
    assert.deepEqual(final[0].equipment, {...before[0].equipment, profile});
    assert.deepEqual(final[0].learning.profile, profile); assert.equal(final[0].learning.points, 0);
    for (const client of clients) await client.disconnect(); await stop(); assertNative(final);
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_ORDINARY_BUY3002_KITBAG_OWNER_RETREAT_PEER_CONTACT_DIRECT_HP300_DUAL_STATE_NATIVE_RESTART_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect(); await stop();
    const saved = new DatabaseSync(database, {readOnly: true});
    try {await backup(saved, output + '-checkpoint.sqlite');} finally {saved.close();}
    writeFileSync(output + '-identity.private.json', JSON.stringify({accounts}), {mode: 0o600});
    chmodSync(output + '-checkpoint.sqlite', 0o600);
    evidence.frames = frames; evidence.events = events; evidence.checkpoint = output + '-checkpoint.sqlite';
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2)); writeFileSync(output + '-server.log', log);
    console.log(String(evidence.status) + ' ' + output + '.json');
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
