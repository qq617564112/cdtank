import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto, type ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatCatalog, combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeRoleAttributes} from '../apps/server/src/battle/roles/recompute';
import {quotePetSkillLearning} from '../apps/shared/combat/pet-learning';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
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
  const speedSkill = combatSkills.get(10231)!;
  assert.equal(speedSkill.triggerType, 5); assert.equal(speedSkill.target, 1);
  assert.equal(speedSkill.attributes.ItemMove, 1);
  assert(speedSkill.functions.some(fn => fn.type === 1 && fn.t === 5));
  assert.equal(combatCatalog.petTypes!.find(row => row.petId === 2)!.baseIds![2], 10231);
  assert.equal(combatCatalog.petSkillPrices!.find(row => row.skillId === 10231)!.cost, 10);
  const port = Number(process.env.PET_HIT_SPEED_PORT);
  assert.equal(port, 3670); assert.equal(process.env.PET_HIT_SPEED_RELEASE, '1');
  const source = 'recovery/output/browser-pet-kill-heal-2026-10-06T02-23-56-449Z';
  const sourceRaw = JSON.parse(readFileSync(source + '.json', 'utf8')) as {coldAfterRestart: unknown[]};
  const parentReview = JSON.parse(readFileSync('recovery/output/pet-kill-heal-root-review.json', 'utf8'));
  assert.equal(parentReview.status, 'PASS_FINITE_ORDINARY_SELECT_PET2_LEARN10211_FINAL_HOSTILE_KILL_HEAL40_BENEFIT_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE');
  assert.equal(parentReview.actualExit, 0);
  assert.equal(parentReview.checkpoint, source + '-checkpoint.sqlite');
  const accounts = JSON.parse(readFileSync(source + '-checkpoint-fixture.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-pet-hit-speed-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const retainedDatabase = new DatabaseSync(database, {readOnly: true});
  const retainedReceipts = ['pet_purchases', 'shop_purchases', 'pet_skill_learning'].map(table => ({table,
    rows: retainedDatabase.prepare(`SELECT * FROM ${table} ORDER BY account_id,request_id`).all()}));
  retainedDatabase.close();
  const fixtureDatabase = new DatabaseSync(database);
  try {
    const row = fixtureDatabase.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(accounts[1].accountId)!;
    const bytes = Uint8Array.from(row.payload as Uint8Array);
    assert.equal(new DataView(bytes.buffer).getUint32(0x80, true), 0);
    new DataView(bytes.buffer).setUint32(0x80, 10, true);
    fixtureDatabase.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, accounts[1].accountId);
  } finally {fixtureDatabase.close();}
  const output = 'recovery/output/pet-hit-speed-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, retainedReceipts, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', sourceIdentity: source + '-checkpoint-fixture.json',
      fundsInjected: false, ownedRecordsInjected: false, pointsInjected: true,
      preServicePoints: [0, 10], earnedPointsProved: false}, simulationTickSeconds: .05,
    policy: {skillId: 10231, durationMs: speedSkill.functions[0].t * 1000, movementBonus: speedSkill.attributes.ItemMove, repeatRefreshNoStack: true, originalEffectSenderUnverified: true},
    scope: 'Existing selected Pet2, rank0 injury movement baseline, Ready LEARN10 cancellation, rank1 injury movement and5s expiry, full dual/native sameDB restart'};
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
  function originalFields(account: AccountState, player: MsgRoomSnapshot['players'][number]): ArmorFields & {movement: {speed: number; turn: number}} {
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
    assert.equal(full.state.roleFloats.get(0x8c), 0);
    assert.equal(full.state.roleFloats.get(0x94), 0);
    const sourceQualification = {playerId: player.id, completed: full.completed,
      recordFields: [...full.state.recordFields], roleIntegers: [...full.state.roleIntegers], roleFloats: [...full.state.roleFloats]};
    (evidence.sourceQualification as unknown[]).push(sourceQualification);
    const fields = recomputeQualifiedRoleArmor(input);
    assert(fields); assert.deepEqual(fields.selectedSkillIds, player.roleSkillSources!.selectedSkillIds);
    const movement = recomputeQualifiedRoleMovement({...input, movementScales: ROLE_INITIAL_MOVEMENT_SCALES});
    assert(movement); return {...fields, movement};
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
        for (const row of native.prepare('SELECT slot,instance_id FROM hotkeys WHERE account_id=? ORDER BY slot').all(account.accountId)) {
          hotkeys[Number(row.slot) - 1] = Number(row.instance_id);
        }
        assert.deepEqual(hotkeys, final[ordinal].inventory.hotkeys);
        return {profile: data, inventory, owned, hotkeys};
      });
      const receipts = [{ordinal: 1, table: 'pet_skill_learning', requestId: 'hit-speed-learn10231',
        expected: (evidence.learned as ServiceType['api']['PetSkillLearning']['res']).learned}];
      evidence.nativeReceipts = receipts.map(row => {
        const value = JSON.parse(String(native.prepare(`SELECT receipt FROM ${row.table} WHERE account_id=? AND request_id=?`)
          .get(accounts[row.ordinal].accountId, row.requestId)!.receipt));
        assert.deepEqual(value, row.expected); return {requestId: row.requestId, receipt: value};
      });
      for (const retained of retainedReceipts) for (const row of retained.rows) {
        assert.deepEqual(native.prepare(`SELECT * FROM ${retained.table} WHERE account_id=? AND request_id=?`)
          .get(row.account_id, row.request_id), row);
      }
    } finally {native.close();}
  }
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  const latest = (i = 0) => frames[i].at(-1)?.snapshot;
  const sequences = [0, 0];
  async function input(i: number, move = 0, turn = 0, aim = 0, fire = false, useItem = 0): Promise<void> {
    const message = {sequence: ++sequences[i], move, turn, aim, fire, useItem, clientTime: Date.now()};
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
    const before = [await query(0), await query(1)]; evidence.before = before;
    const expectedInitial = structuredClone(sourceRaw.coldAfterRestart) as AccountState[];
    for (const state of [expectedInitial[1].equipment.profile, expectedInitial[1].learning.profile!]) {
      const bytes = Uint8Array.from(state.bytes); new DataView(bytes.buffer).setUint32(0x80, 10, true); state.bytes = [...bytes];
    }
    expectedInitial[1].learning.points = 10;
    const prices = new Map(combatCatalog.petSkillPrices!.map(row => [row.skillId, row]));
    expectedInitial[1].learning.quotes = expectedInitial[1].owned.base.flatMap(record => {
      const fields = new Map(record.fields), petId = fields.get(8);
      const metadata = combatCatalog.petTypes!.find(row => row.petId === petId)!;
      const definition = {petId: metadata.petId, baseIds: metadata.baseIds!, rankCaps: metadata.rankCaps!};
      return Array.from({length: 6}, (_, slot) => quotePetSkillLearning({
        owned: {name: record.name, fields}, definition, prices, slot, points: 10,
      })).flatMap(quote => quote ? [quote] : []);
    });
    assert.deepEqual(before, expectedInitial);
    const peerPet = before[1].owned.base.find(row => new Map(row.fields).get(0) === 3)!;
    const peerFields = new Map(peerPet.fields);
    assert.equal(peerFields.get(8), 2); assert.equal(peerFields.get(0x4c), 10231); assert.equal(peerFields.get(0x64), 0);
    assert.equal(peerFields.get(0x44), 10211); assert.equal(peerFields.get(0x5c), 1);
    assert.equal(peerFields.get(0x48), 10221); assert.equal(peerFields.get(0x60), 1);
    await must(clients[1].callApi('SelectRole', {kind: 'pet', instanceId: 3}));
    const afterSelect = [await query(0), await query(1)]; evidence.afterSelect = afterSelect;
    assert.deepEqual(afterSelect[0], before[0]);
    const selectedProfile = structuredClone(before[1].equipment.profile);
    const selectedBytes = Uint8Array.from(selectedProfile.bytes); new DataView(selectedBytes.buffer).setUint32(0xa4, 3, true);
    selectedProfile.bytes = [...selectedBytes];
    assert.deepEqual(afterSelect[1].equipment, {...before[1].equipment, profile: selectedProfile});
    assert.deepEqual(afterSelect[1].owned, before[1].owned); assert.deepEqual(afterSelect[1].inventory, before[1].inventory);
    let afterLearning: AccountState[] | undefined;
    for (const learned of [false, true]) {
      const created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
        mode: 4, mapId: 7, roomName: '受击移动', name: 'SpeedHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
      const joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
        roomId: created.room.id, clientId: 'unused', name: 'SpeedPeer', tankId: 3}));
      const roomId = created.room.id;
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
        && latest(i)?.players.length === 2));
      if (learned) {
        await must(clients[1].callApi('Ready', {round: 1}));
        await wait(() => [0, 1].every(i => latest(i)?.match?.readyPlayerIds.includes(joined.playerId) === true));
        const result = await must<ServiceType['api']['PetSkillLearning']['res']>(clients[1].callApi('PetSkillLearning', {
          operation: 'LEARN', instanceId: 3, slot: 2, requestId: 'hit-speed-learn10231'}));
        assert.deepEqual(result.learned, {instanceId: 3, slot: 2, skillId: 10231, rank: 1, cost: 10});
        assert.equal(result.points, 0); evidence.learned = result;
        await wait(() => [0, 1].every(i => latest(i)?.phase === 'WAITING' && latest(i)?.match?.readyPlayerIds.length === 0
          && latest(i)?.players.find(p => p.id === joined.playerId)?.roleSkillSources?.equipmentSkills[2].rank === 1));
        afterLearning = [await query(0), await query(1)]; evidence.afterLearning = afterLearning;
      }
      const states = [await query(0), await query(1)];
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
      const ids = [created.playerId, joined.playerId];
      const player = (i: number) => latest()!.players.find(p => p.id === ids[i])!;
      assert.equal(player(0).petId, 102); assert.equal(player(1).petId, 2);
      assert.equal(created.room.mode <= 3 && player(0).team === player(1).team, false);
      assert.deepEqual(player(1).roleSkillSources!.equipmentSkills[2], {baseId: 10231, rank: learned ? 1 : 0});
      assert.deepEqual(player(1).roleSkillSources!.equipmentSkills[1], {baseId: 10221, rank: 1});
      const armor = [originalFields(states[0], player(0)), originalFields(states[1], player(1))];
      const raw = armor.map(fields => Math.round(Math.max(0, fields.attackBase * fields.attackPercent + fields.attackBonus)));
      const starts = events.map(rows => rows.length);
      const core = (i: number) => events[i].slice(starts[i]).filter(row => row.event.roomId === roomId);
      const phase: Record<string, unknown> = {roomId, learned, states, armor, raw, hits: []};
      (evidence.phases as unknown[]).push(phase);
      async function orient(i: number, turnBody: boolean): Promise<void> {
        for (let n = 0; n < 300; n++) {
          const p = player(i), other = player(1 - i);
          const bearing = Math.atan2(other.x - p.x, other.z - p.z);
          const difference = wrapped(bearing - (turnBody ? p.bodyYaw! : p.yaw + p.aim));
          if (Math.abs(difference) < .025) {await input(i); return;}
          await input(i, 0, turnBody ? Math.sign(difference) : 0, turnBody ? 0 : Math.sign(difference));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.fail('Ordinary facing did not settle');
      }
      async function shot(i: number): Promise<void> {
        const targetOrdinal = 1 - i;
        assert(player(i).alive && player(targetOrdinal).alive);
        await orient(targetOrdinal, true); await orient(i, false);
        await wait(() => player(i).reload?.remaining === 0);
        const beforeShot = structuredClone(latest()!), hp = player(targetOrdinal).hp;
        const shooterHp = player(i).hp;
        const eventStarts = events.map(rows => rows.length);
        const hits = (j: number) => events[j].slice(eventStarts[j]).filter(row => row.event.roomId === roomId
          && row.event.type === 'hit' && row.event.playerId === ids[i] && row.event.targetId === ids[targetOrdinal]);
        await input(i, 0, 0, 0, true);
        try {await wait(() => hits(0).length > 0 && hits(1).length > 0);} finally {await input(i);}
        assert.equal(hits(0).length, 1); assert.deepEqual(hits(0)[0].event, hits(1)[0].event);
        const critical = hits(0)[0].event.shotPlayerResult?.critical; assert(typeof critical === 'boolean');
        const victim = player(targetOrdinal), shooter = player(i);
        const angle = Math.abs(wrapped(Math.atan2(shooter.x - victim.x, shooter.z - victim.z) - victim.bodyYaw!));
        assert(angle <= Math.PI / 4);
        const damage = expectedArmorDamage(raw[i] * (critical ? 2 : 1), armor[targetOrdinal], 1);
        assert(Math.abs(hits(0)[0].event.value - damage) < 1e-8);
        const expectedHp = Math.max(0, (hp - damage) | 0);
        await wait(() => player(targetOrdinal).hp === expectedHp &&
          player(i).hp === shooterHp &&
          player(targetOrdinal).roleSkillSources!.currentSkillIds.includes(10231) === (targetOrdinal === 1 && learned));
        const after = structuredClone(latest()!);
        (phase.hits as unknown[]).push({ordinal: i, critical, angle, damage, hpBefore: hp, expectedHp,
          before: beforeShot, after, dual: await dual(after), event: hits(0)[0],
          shooterHpBefore: shooterHp, shooterHpAfter: player(i).hp});
      }
      assert(!player(1).roleSkillSources!.currentSkillIds.includes(10231));
      const initialPosition = structuredClone(player(0));
      await orient(0, true);
      await input(0, -1);
      try {
        await wait(() => Math.hypot(player(0).x - initialPosition.x, player(0).z - initialPosition.z) >= 100, 15000);
      } finally {await input(0);}
      await wait(() => {
        const rows = frames[0].slice(-2); if (rows.length < 2) return false;
        const [a, b] = rows.map(row => row.snapshot.players.find(p => p.id === ids[0])!);
        return a.x === b.x && a.z === b.z;
      });
      phase.ownerRetreat = {before: initialPosition, after: structuredClone(player(0))};
      async function measure(name: string, expectedMovement: {speed: number; turn: number}, active: boolean): Promise<void> {
        await orient(1, true);
        const start = frames[0].length;
        await input(1, 1);
        try {await wait(() => frames[0].length >= start + 11, 3000);} finally {await input(1);}
        const samples = frames[0].slice(start, start + 11);
        const first = samples[0], last = samples.at(-1)!;
        const firstPlayer = first.snapshot.players.find(p => p.id === ids[1])!;
        const lastPlayer = last.snapshot.players.find(p => p.id === ids[1])!;
        const simulationSeconds = (last.snapshot.tick - first.snapshot.tick) * .05;
        const distance = Math.hypot(lastPlayer.x - firstPlayer.x, lastPlayer.z - firstPlayer.z);
        assert.equal(simulationSeconds, .5);
        assert(Math.abs(distance / simulationSeconds - expectedMovement.speed) < .3,
          `${name}: observed ${distance / simulationSeconds} expected ${expectedMovement.speed}`);
        for (const row of samples) {
          const p = row.snapshot.players.find(p => p.id === ids[1])!;
          assert.equal(p.roleSkillSources!.currentSkillIds.includes(10231), active);
          assert.equal(p.hp, firstPlayer.hp); assert.equal(p.aim, firstPlayer.aim);
          assert(Math.abs(wrapped(p.bodyYaw! - firstPlayer.bodyYaw!)) < .001);
        }
        const timing = {simulationSeconds, serverMilliseconds: last.snapshot.serverTime - first.snapshot.serverTime,
          wallMilliseconds: last.wallTime - first.wallTime};
        ((phase.movement ??= []) as unknown[]).push({name, expectedMovement, distance,
          observedSpeed: distance / simulationSeconds, timing, samples, firstDual: await dual(first.snapshot), lastDual: await dual(last.snapshot)});
        await wait(() => {
          const rows = frames[0].slice(-2); if (rows.length < 2) return false;
          const [a, b] = rows.map(row => row.snapshot.players.find(p => p.id === ids[1])!);
          return a.x === b.x && a.z === b.z;
        });
      }
      await shot(0);
      assert(player(1).alive && player(1).hp > 0);
      assert.equal(player(1).roleSkillSources!.currentSkillIds.filter(id => id === 10231).length, learned ? 1 : 0);
      const injured = structuredClone(latest()!);
      phase.injured = {snapshot: injured, dual: await dual(injured)};
      if (!learned) {
        await measure('unlearnedInjuryBaseline', armor[1].movement, false);
      } else {
        const active = originalFields(states[1], player(1)); phase.activeSources = active;
        assert.equal(active.movement.speed - armor[1].movement.speed, ROLE_INITIAL_MOVEMENT_SCALES.move);
        assert.equal(active.movement.turn, armor[1].movement.turn);
        await measure('learnedInjuryActive', active.movement, true);
        await wait(() => [0, 1].every(i => !latest(i)!.players.find(p => p.id === ids[1])!
          .roleSkillSources!.currentSkillIds.includes(10231)), 7000);
        const firstExpired = frames[0].find(row => row.snapshot.roomId === roomId && row.snapshot.tick > injured.tick
          && !row.snapshot.players.find(p => p.id === ids[1])!.roleSkillSources!.currentSkillIds.includes(10231))!;
        const lastActive = frames[0].filter(row => row.snapshot.roomId === roomId && row.snapshot.tick >= injured.tick
          && row.snapshot.players.find(p => p.id === ids[1])!.roleSkillSources!.currentSkillIds.includes(10231)).at(-1)!;
        const expired = structuredClone(firstExpired.snapshot);
        const expiryWall = firstExpired.wallTime;
        const injuryWall = frames[0].find(row => key(row.snapshot) === key(injured))!.wallTime;
        const timing = {simulationSeconds: (expired.tick - injured.tick) * .05,
          serverMilliseconds: expired.serverTime - injured.serverTime, wallMilliseconds: expiryWall - injuryWall};
        assert(timing.simulationSeconds >= 4.95 && timing.simulationSeconds <= 5.1);
        assert(timing.serverMilliseconds >= 4950 && timing.serverMilliseconds <= 5100);
        const restoredSources = originalFields(states[1], player(1));
        assert.deepEqual(restoredSources, armor[1]);
        phase.expired = {snapshot: expired, dual: await dual(expired), lastActive: await dual(lastActive.snapshot), timing, restoredSources};
        await measure('learnedAfterExpiryBaseline', restoredSources.movement, false);
      }
      assert.equal(core(0).filter(row => row.event.type === 'destroy').length, 0);
      assert.equal(core(0).filter(row => row.event.type === 'playerHealed').length, 0);
      assert.equal(core(0).filter(row => row.event.type === 'itemUsed').length, 0);
      assert.deepEqual(core(0).map(row => row.event), core(1).map(row => row.event));
      phase.sharedEventsBeforeLeave = structuredClone(core(0));
      const remote = new Map(frames[1].filter(row => row.snapshot.roomId === roomId).map(row => [key(row.snapshot), row.snapshot]));
      const common = new Set<string>();
      for (const row of frames[0].filter(row => row.snapshot.roomId === roomId)) {
        const peer = remote.get(key(row.snapshot)); if (peer) {assert.deepEqual(row.snapshot, peer); common.add(key(row.snapshot));}
      }
      assert(common.size > 50); phase.commonUniqueFullSnapshots = common.size;
      for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    }
    assert(afterLearning);
    const final = [await query(0), await query(1)]; evidence.final = final;
    assert.deepEqual(final[0], before[0]);
    const expectedProfile = structuredClone(selectedProfile);
    const finalBytes = Uint8Array.from(expectedProfile.bytes); new DataView(finalBytes.buffer).setUint32(0x80, 0, true);
    expectedProfile.bytes = [...finalBytes];
    assert.deepEqual(final[1].equipment, {...before[1].equipment, profile: expectedProfile});
    const expectedOwned = structuredClone(before[1].owned);
    const expectedPet = expectedOwned.base.find(row => new Map(row.fields).get(0) === 3)!;
    const expectedFields = new Map(expectedPet.fields); expectedFields.set(0x64, 1); expectedPet.fields = [...expectedFields];
    assert.deepEqual(final[1].owned, expectedOwned); assert.deepEqual(final[1].inventory, before[1].inventory);
    assert.deepEqual(final[1].learning, afterLearning[1].learning);
    assert.deepEqual(final[1].learning.owned, expectedOwned); assert.deepEqual(final[1].learning.profile, expectedProfile);
    assert.equal(final[1].learning.points, 0);
    for (const client of clients) await client.disconnect(); await stop(); assertNative(final);
    await start(); await authenticate();
    const restored = [await query(0), await query(1)]; assert.deepEqual(restored, final); evidence.restored = restored;
    evidence.status = 'PASS_FINITE_ORDINARY_EXISTING_PET2_LEARN10231_HOSTILE_INJURY_SPEED5S_EXPIRE_BASELINE_MOVE_READY_DUAL_STATE_NATIVE_RESTART_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect(); await stop();
    const saved = new DatabaseSync(database, {readOnly: true});
    try {await backup(saved, output + '-checkpoint.sqlite');} finally {saved.close();}
    chmodSync(output + '-checkpoint.sqlite', 0o600);
    writeFileSync(output + '-identity.private.json', JSON.stringify({accounts}), {mode: 0o600});
    evidence.frames = frames; evidence.events = events; evidence.checkpoint = output + '-checkpoint.sqlite';
    rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2)); writeFileSync(output + '-server.log', log);
    console.log(String(evidence.status) + ' ' + output + '.json');
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
