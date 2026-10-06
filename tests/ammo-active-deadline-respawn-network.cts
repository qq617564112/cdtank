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
  const port = Number(process.env.AMMO_ACTIVE_RESPAWN_PORT);
  assert.equal(port, 3651);
  assert.equal(process.env.AMMO_ACTIVE_RESPAWN_RELEASE, '1', 'Requires coordinated compiled release');
  const acceptedSource = 'recovery/output/shot-hurt-resistance-network-2026-10-05T23-18-45-702Z';
  const source = acceptedSource;
  const identitySource = source;
  const accounts = JSON.parse(readFileSync(identitySource + '-identity.private.json', 'utf8')).accounts as
    {accountId: string; token: string}[];
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-ammo-active-respawn-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const output = 'recovery/output/ammo-active-deadline-respawn-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, phases: [], leaves: [], sourceQualification: [],
    fixture: {source: source + '-checkpoint.sqlite', fundsInjected: false, pointsInjected: false,
      ownedRecordsInjected: false, newBUY: false, sourceIdentity: identitySource + '-identity.private.json'},
    simulationTickSeconds: .05,
    scope: 'Only previously unproved active ordinary last-shot deadline at natural respawn; no BUY/LEARN/funds/points/source modification'};
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
  const key = (s: MsgRoomSnapshot) => [s.roomId, s.match?.round, s.phase, s.tick, s.serverTime].join(':');
  async function captureDual(snapshot: MsgRoomSnapshot) {
    const frameKey = key(snapshot);
    await wait(() => frames[1].some(row => key(row.snapshot) === frameKey));
    const pair = frames.map(rows => rows.find(row => key(row.snapshot) === frameKey)!);
    assert.deepEqual(pair[0].snapshot, pair[1].snapshot);
    return structuredClone(pair);
  }
  try {
    await start(); await authenticate();
    const before = [await query(0), await query(1)]; evidence.before = before;
    let created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
      mode: 4, mapId: 7, roomName: '装填复活', name: 'ReloadHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
    let joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
      roomId: created.room.id, clientId: 'unused', name: 'ReloadPeer', tankId: 3}));
    let roomId = created.room.id;
    const latest = (i = 0) => frames[i].at(-1)?.snapshot;
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
      && latest(i)?.players.length === 2));
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
    const player = (id: string) => latest()!.players.find(p => p.id === id)!;
    const sourceStates = [await query(0), await query(1)]; evidence.sourceStates = sourceStates;
    const targetFields = originalFields(sourceStates[0], player(created.playerId));
    const shooterFields = originalFields(sourceStates[1], player(joined.playerId));
    assert.equal(player(created.playerId).petId, 105);
    assert.equal(player(joined.playerId).ammoItemId, 2001);
    assert.equal(created.room.mode <= 3 && player(created.playerId).team === player(joined.playerId).team, false);
    const qualification = (evidence.sourceQualification as {playerId: string; recordFields: [number, number][];
      roleFloats: [number, number][]}[]).find(row => row.playerId === created.playerId)!;
    const capacity = new Map(qualification.recordFields).get(0x38)!;
    const normalSeconds = new Map(qualification.roleFloats).get(0x50)!;
    const lastSeconds = new Map(qualification.roleFloats).get(0x54)!;
    assert.equal(capacity, 7); assert.equal(normalSeconds, 1.5); assert.equal(lastSeconds, 4.5);
    const raw = Math.round(Math.max(0, shooterFields.attackBase * shooterFields.attackPercent + shooterFields.attackBonus));
    assert.equal(raw, 151);
    const ordinaryDamage = expectedArmorDamage(raw, targetFields, 1);
    evidence.numericSource = {qualification, capacity, normalSeconds, lastSeconds, raw, ordinaryDamage};
    const sequences = [0, 0];
    const inputs: unknown[] = [];
    evidence.inputs = inputs;
    async function input(i: number, turn = 0, aim = 0, fire = false): Promise<void> {
      const value = {sequence: ++sequences[i], move: 0, turn,
        aim, fire, useItem: 0, clientTime: Date.now()};
      inputs.push({ordinal: i, playerId: i === 0 ? created.playerId : joined.playerId,
        roomId, observedTick: latest()?.tick, ...value});
      assert((await clients[i].sendMsg('PlayerInput', value)).isSucc);
    }
    const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
    async function align(): Promise<void> {
      for (let n = 0; n < 300; n++) {
        const a = player(joined.playerId), b = player(created.playerId);
        const difference = wrapped(Math.atan2(b.x - a.x, b.z - a.z) - a.yaw - a.aim);
        if (Math.abs(difference) < .025) {await input(1); break;}
        await input(1, 0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
        assert(n < 299, 'Ordinary peer aim did not settle');
      }
      for (let n = 0; n < 300; n++) {
        const b = player(created.playerId), a = player(joined.playerId);
        assert(typeof b.bodyYaw === 'number');
        const difference = wrapped(Math.atan2(a.x - b.x, a.z - b.z) - b.bodyYaw);
        if (Math.abs(difference) < .045) {await input(0); break;}
        await input(0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
        assert(n < 299, 'Ordinary target body did not settle');
      }
    }
    async function hostileHit() {
      await wait(() => player(joined.playerId).reload?.remaining === 0);
      const hpBefore = player(created.playerId).hp, indices = events.map(rows => rows.length);
      const hit = (i: number) => events[i].slice(indices[i]).find(row => row.event.roomId === roomId
        && row.event.type === 'hit' && row.event.playerId === joined.playerId && row.event.targetId === created.playerId);
      await input(1, 0, 0, true); await wait(() => !!hit(0) && !!hit(1)); await input(1);
      assert.deepEqual(hit(0)!.event, hit(1)!.event);
      const critical = hit(0)!.event.shotPlayerResult?.critical;
      assert(typeof critical === 'boolean');
      const damage = ordinaryDamage * (critical ? 2 : 1);
      assert(Math.abs(hit(0)!.event.value - damage) < 1e-8);
      await wait(() => player(created.playerId).hp === Math.max(0, (hpBefore - damage) | 0));
      const phase = {hpBefore, damage, critical, hit: hit(0), after: structuredClone(latest())};
      (evidence.phases as unknown[]).push(phase); return phase;
    }
    // Natural critical samples may kill during preparation; no HP or RNG is altered.
    async function freshRoom(): Promise<void> {
      for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
      created = await must<ServiceType['api']['CreateRoom']['res']>(clients[0].callApi('CreateRoom', {
        mode: 4, mapId: 7, roomName: '装填复活', name: 'ReloadHost', tankId: 3, minPlayers: 2, maxPlayers: 2}));
      joined = await must<ServiceType['api']['Join']['res']>(clients[1].callApi('Join', {
        roomId: created.room.id, clientId: 'unused', name: 'ReloadPeer', tankId: 3}));
      roomId = created.room.id;
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'WAITING'
        && latest(i)?.players.length === 2));
      for (const client of clients) await must(client.callApi('Ready', {round: 1}));
      await wait(() => [0, 1].every(i => latest(i)?.roomId === roomId && latest(i)?.phase === 'PLAYING'));
      originalFields(sourceStates[0], player(created.playerId));
      originalFields(sourceStates[1], player(joined.playerId));
    }
    let softened = false;
    for (let sample = 0; sample < 40; sample++) {
      if (!player(created.playerId).alive) await freshRoom();
      await align();
      if (player(created.playerId).hp <= ordinaryDamage) {softened = true; break;}
      await hostileHit();
      if (player(created.playerId).alive && player(created.playerId).hp <= ordinaryDamage) {
        softened = true;
        break;
      }
    }
    assert(softened, 'Bounded natural preparation did not reach a living single-hit deficit');
    evidence.softened = structuredClone(latest());
    // Target turret aims away while its body retains FRONT incoming qualification.
    for (let n = 0; n < 300; n++) {
      const b = player(created.playerId), a = player(joined.playerId);
      const away = Math.atan2(b.x - a.x, b.z - a.z);
      const difference = wrapped(away - b.yaw - b.aim);
      if (Math.abs(difference) < .025) {await input(0); break;}
      await input(0, 0, Math.sign(difference)); await new Promise(resolve => setTimeout(resolve, 50));
      assert(n < 299, 'Ordinary target turret did not settle away from peer');
    }
    for (let shot = 0; shot < capacity; shot++) {
      await wait(() => player(created.playerId).reload?.remaining === 0);
      assert.equal(player(created.playerId).ammoMagazine!.remaining, capacity - shot);
      await input(0, 0, 0, true);
      await wait(() => player(created.playerId).ammoMagazine!.remaining === capacity - shot - 1);
      await input(0);
      assert.equal(player(created.playerId).reload!.duration, shot === capacity - 1 ? lastSeconds : normalSeconds);
    }
    const lastShot = structuredClone(latest()!), oldReload = {...player(created.playerId).reload!};
    const lastShotReceivedAt = frames[0].at(-1)!.wallTime;
    assert(oldReload.remaining > 3.5);
    assert.equal(player(created.playerId).ammoMagazine!.remaining, 0);
    evidence.lastShot = lastShot; evidence.oldReload = oldReload;
    evidence.lastShotDual = await captureDual(lastShot);
    const lifeEventIndices = events.map(rows => rows.length);
    await hostileHit();
    await wait(() => [0, 1].every(i => latest(i)?.players.find(p => p.id === created.playerId)?.alive === false));
    const death = structuredClone(latest()!); evidence.death = death;
    evidence.deathDual = await captureDual(death);
    assert(death.serverTime < oldReload.startedAt + lastSeconds * 1000);
    await wait(() => [0, 1].every(i => latest(i)?.players.find(p => p.id === created.playerId)?.alive === true), 10000);
    const restored = structuredClone(latest()!), restoredPlayer = player(created.playerId);
    const restoredReceivedAt = frames[0].at(-1)!.wallTime;
    assert(restored.serverTime < oldReload.startedAt + lastSeconds * 1000, 'Old server deadline must still be in the future');
    assert((restored.tick - lastShot.tick) * .05 < lastSeconds, 'Old simulation deadline must still be in the future');
    assert(restoredReceivedAt - lastShotReceivedAt < lastSeconds * 1000,
      'Wall reception must also show reset before the old loading duration');
    evidence.deadlineTimeBases = {lastShotReceivedAt, restoredReceivedAt,
      simulationSeconds: (restored.tick - lastShot.tick) * .05,
      serverMilliseconds: restored.serverTime - oldReload.startedAt,
      wallMilliseconds: restoredReceivedAt - lastShotReceivedAt};
    assert.equal(restoredPlayer.reload!.startedAt, 0); assert.equal(restoredPlayer.reload!.duration, 0);
    assert.equal(restoredPlayer.reload!.remaining, 0);
    assert.deepEqual(restoredPlayer.ammoMagazine, {remaining: capacity, capacity});
    assert.equal(restoredPlayer.ammoItemId, 2001); assert.equal(restoredPlayer.hp, restoredPlayer.maxHp);
    evidence.restoredLife = restored;
    evidence.restoredLifeDual = await captureDual(restored);
    for (const id of [created.playerId, joined.playerId]) {
      assert.deepEqual(restored.players.find(p => p.id === id)!.roleSkillSources,
        lastShot.players.find(p => p.id === id)!.roleSkillSources);
    }
    const freshFireIndices = events.map(rows => rows.length);
    const freshFire = (i: number) => events[i].slice(freshFireIndices[i]).filter(row =>
      row.event.roomId === roomId && row.event.type === 'fire' && row.event.playerId === created.playerId);
    await input(0, 0, 0, true);
    await wait(() => player(created.playerId).ammoMagazine!.remaining === capacity - 1
      && freshFire(0).length === 1 && freshFire(1).length === 1);
    await input(0);
    assert.deepEqual(freshFire(0)[0].event, freshFire(1)[0].event);
    assert.equal(player(created.playerId).reload!.duration, normalSeconds);
    assert(player(created.playerId).reload!.startedAt < oldReload.startedAt + lastSeconds * 1000,
      'Fresh life shot must fire before the canceled old deadline');
    assert((latest()!.tick - lastShot.tick) * .05 < lastSeconds,
      'Fresh life shot must precede the old loading window in simulation time');
    evidence.newLifeFire = freshFire(0)[0];
    evidence.newLifeShot = structuredClone(latest());
    evidence.newLifeShotDual = await captureDual(latest()!);
    const lifeCore = (i: number) => events[i].slice(lifeEventIndices[i]).filter(row =>
      row.event.roomId === roomId && ['hit', 'destroy', 'respawn', 'fire'].includes(row.event.type)
      && (row.event.playerId === created.playerId || row.event.targetId === created.playerId));
    await wait(() => lifeCore(0).length === lifeCore(1).length);
    assert.deepEqual(lifeCore(0).map(row => row.event), lifeCore(1).map(row => row.event));
    assert.equal(lifeCore(0).filter(row => row.event.type === 'respawn').length, 1);
    assert.equal(lifeCore(0).filter(row => row.event.type === 'destroy').length, 1);
    evidence.lifeCoreEvents = lifeCore(0);
    const remote = new Map(frames[1].filter(row => row.snapshot.phase === 'PLAYING').map(row => [key(row.snapshot), row.snapshot]));
    const common = new Set<string>();
    for (const row of frames[0]) {
      if (row.snapshot.phase !== 'PLAYING') continue;
      const peer = remote.get(key(row.snapshot)); if (peer) {assert.deepEqual(row.snapshot, peer); common.add(key(row.snapshot));}
    }
    assert(common.size > 100); evidence.commonUniqueFullSnapshots = common.size;
    for (const client of clients) (evidence.leaves as unknown[]).push(await must(client.callApi('Leave', {roomId, round: 1})));
    const final = [await query(0), await query(1)]; assert.deepEqual(final, before); evidence.final = final;
    evidence.status = 'PASS_FINITE_ORDINARY_ACTIVE_LAST_DEADLINE_NATURAL_DEATH_RESPAWN_RESET_DUAL_STATE_LEAVE_SCOPE';
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
