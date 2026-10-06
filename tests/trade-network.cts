import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync, backup} from 'node:sqlite';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgTradeState} from '../apps/shared/protocols/MsgTradeState';
import type {ReqTrade, ResTrade, TradeAccount, TradeOffer} from '../apps/shared/protocols/PtlTrade';
import type {OwnedRoleRecordData} from '../apps/shared/protocols/PtlOwnedRoles';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../apps/shared/protocols';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatItemSkills, combatLimits, combatSkills} from '../apps/server/src/battle/catalog';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {readRoleSkillSources} from '../apps/server/src/battle/roles/skill-sources';
import {selectRoleSkills} from '../apps/server/src/battle/roles/skills';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {freezeSelectedBoundSource} from '../apps/server/src/battle/roles/selected-bound-source';

async function must<T>(promise: Promise<{isSucc: true; res: T} | {isSucc: false; err: unknown}>): Promise<T> {
  const result = await promise;
  assert(result.isSucc, JSON.stringify(result));
  return result.res;
}

async function main(): Promise<void> {
  const port = Number(process.env.TRADE_PORT);
  assert.equal(port, 3607, 'Use the coordinated Trade window');
  const directedTail = process.env.TRADE_DIRECTED_TAIL === '1';
  const source = 'recovery/output/pet-learning-network-2026-10-05T19-06-05-701Z';
  const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as {accountId: string; token: string}[];
  assert.equal(identities.length, 2);
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-trade-'));
  const database = join(directory, 'accounts.sqlite');
  const original = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
  try {await backup(original, database);} finally {original.close();}
  const fixture = new DatabaseSync(database);
  const initialBalances = [{originality: 50, skillPoints: 200}, {originality: 25, skillPoints: 100}];
  try {
    for (const [index, identity] of identities.entries()) {
      const row = fixture.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(identity.accountId)!;
      const bytes = new Uint8Array(row.payload as Uint8Array);
      const view = new DataView(bytes.buffer);
      view.setUint32(0x7c, initialBalances[index].originality, true);
      view.setUint32(0x80, initialBalances[index].skillPoints, true);
      fixture.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes, identity.accountId);
    }
  } finally {fixture.close();}
  const output = 'recovery/output/trade-network-' + new Date().toISOString().replace(/[:.]/g, '-');
  const evidence: Record<string, unknown> = {status: 'RUNNING', port, directedTail,
    reusedGateRaw: directedTail ? 'recovery/output/trade-network-2026-10-05T19-27-27-205Z.json' : undefined,
    fixture: {source: source + '-checkpoint.sqlite', preServiceBalances: initialBalances,
      earnedBalancesProved: false, ownedRecordsInjected: false, fundsMoneyInjected: false},
    scope: 'Normal invite/accept/reject, offer/show/unshow/dual-confirm/cancel, scalar transfer, owned pet/tank and partial stack merge, dual complete settlement state, native persistence and same-database restart.'};
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: `ws://127.0.0.1:${port}`,
    logger: undefined, heartbeat: {interval: 5000, timeout: 10000}}));
  const messages: {state: MsgTradeState; wallTime: number}[][] = [[], []];
  const frames: {snapshot: MsgRoomSnapshot; wallTime: number}[][] = [[], []];
  const events: MsgRoomEvent[][] = [[], []];
  clients.forEach((client, index) => client.listenMsg('TradeState', state => {
    messages[index].push({state, wallTime: Date.now()});
  }));
  clients.forEach((client, index) => {
    client.listenMsg('RoomSnapshot', snapshot => {frames[index].push({snapshot, wallTime: Date.now()});});
    client.listenMsg('RoomEvent', event => {events[index].push(event);});
  });
  const calls: unknown[] = [];
  let server: ChildProcess | undefined, log = '';
  async function wait(predicate: () => boolean, timeout = 15000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), log.slice(-800));
  }
  async function start(): Promise<void> {
    const from = log.length;
    server = spawn(process.execPath, ['scripts/start-server.mjs'], {
      env: {...process.env, PORT: String(port), ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe']});
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    await wait(() => log.slice(from).includes(`Server started at ${port}.`));
  }
  async function stop(): Promise<void> {
    if (server?.exitCode === null && server.signalCode === null) {
      const closed = new Promise(resolve => server!.once('close', resolve));
      server.kill(); await closed;
    }
  }
  async function authenticate(): Promise<void> {
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      await must(client.callApi('Account', {token: identities[index].token}));
    }
  }
  async function trade(index: number, request: ReqTrade): Promise<ResTrade> {
    const result = await clients[index].callApi('Trade', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(result.isSucc, JSON.stringify(result));
    return result.res;
  }
  async function reject(index: number, request: ReqTrade): Promise<void> {
    const result = await clients[index].callApi('Trade', request);
    calls.push({index, request, result, wallTime: Date.now()});
    assert(!result.isSucc, 'Expected rejection: ' + JSON.stringify(result));
  }
  async function accounts(): Promise<TradeAccount[]> {
    return [(await trade(0, {operation: 'QUERY'})).account, (await trade(1, {operation: 'QUERY'})).account];
  }
  const empty = (): TradeOffer => ({money: 0, originality: 0, skillPoints: 0, records: []});
  const fields = (record: OwnedRoleRecordData) => new Map(record.fields);
  const withoutId = (record: OwnedRoleRecordData, idOffset: number) => ({name: record.name,
    fields: record.fields.filter(([offset]) => offset !== idOffset)});
  try {
    await start(); await authenticate();
    const acquisitions = [];
    for (const [index, quantity] of [2, 5].entries()) {
      acquisitions.push(await must(clients[index].callApi('Shop', {operation: 'BUY', itemTableId: 1,
        quantity, currency: 'MONEY', requestId: `trade_first_feed_${index}`})));
    }
    evidence.acquisitions = acquisitions;
    const before = await accounts(); evidence.before = before;
    const pet = before[1].owned.base.find(row => fields(row).get(8) === 2 && fields(row).get(0x6c) === 1
      && fields(row).get(0x5c) === 0)!;
    const purchasedTank = before[1].owned.equipment.find(row => fields(row).get(0x24) === 52)!;
    assert(pet && purchasedTank, 'Use the legitimate learned Pet2 and purchased Tank52 checkpoint');
    const petId = fields(pet).get(0)!, tankId = fields(purchasedTank).get(0x1c)!;
    const maintained = await must(clients[1].callApi('TankMaintenance', {operation: 'MAINTAIN',
      instanceId: tankId, days: 1, currency: 1, requestId: 'trade_first_nonzero_tank_minutes'}));
    const tank = maintained.owned.equipment.find(row => fields(row).get(0x1c) === tankId)!;
    assert(tank && fields(tank).get(0x34)! > 0, 'Trade must preserve a nonzero normally maintained lifetime');
    evidence.maintenancePrerequisite = maintained;
    await must(clients[1].callApi('SelectRole', {kind: 'pet', instanceId: petId}));
    await must(clients[1].callApi('SelectRole', {kind: 'tank', instanceId: tankId}));
    const baseline = await accounts(); evidence.baseline = baseline;
    const recipientStack = baseline[0].inventory.records.find(row => row.itemTableId === 1)!;
    const donorStack = baseline[1].inventory.records.find(row => row.itemTableId === 1)!;
    assert.equal(recipientStack.ownedQuantity, 2); assert.equal(donorStack.ownedQuantity, 5);

    let response: ResTrade;
    if (!directedTail) {
    response = await trade(0, {operation: 'INVITE', targetAccountId: identities[1].accountId});
    const rejectedId = response.session!.id;
    response = await trade(1, {operation: 'RESPOND', sessionId: rejectedId, accept: false});
    assert.equal(response.session!.phase, 'CANCELLED');
    assert.deepEqual(await accounts(), baseline);
    evidence.rejectedInvitation = response.session;

    response = await trade(0, {operation: 'INVITE', targetAccountId: identities[1].accountId});
    const cancelledId = response.session!.id;
    response = await trade(1, {operation: 'RESPOND', sessionId: cancelledId, accept: true});
    response = await trade(0, {operation: 'CANCEL', sessionId: cancelledId});
    assert.equal(response.session!.phase, 'CANCELLED');
    assert.deepEqual(await accounts(), baseline); evidence.cancelledSession = response.session;
    }

    response = await trade(0, {operation: 'INVITE', targetAccountId: identities[1].accountId});
    const sessionId = response.session!.id;
    response = await trade(1, {operation: 'RESPOND', sessionId, accept: true});
    let revision = response.session!.revision;
    if (!directedTail) {
    await reject(0, {operation: 'OFFER', sessionId, expectedRevision: revision,
      offer: {...empty(), records: [{kind: 'pet', instanceId: petId}]}});
    await reject(0, {operation: 'OFFER', sessionId, expectedRevision: revision,
      offer: {...empty(), money: baseline[0].wallet!.money + 1}});
    }
    const offers: [TradeOffer, TradeOffer] = [
      {money: 500, originality: 25, skillPoints: 70, records: []},
      {money: 300, originality: 10, skillPoints: 100, records: [
        {kind: 'pet', instanceId: petId}, {kind: 'tank', instanceId: tankId},
        {kind: 'item', instanceId: donorStack.instanceId, quantity: 2}]},
    ];
    const stale = revision;
    response = await trade(0, {operation: 'OFFER', sessionId, expectedRevision: revision, offer: offers[0]});
    revision = response.session!.revision;
    if (!directedTail) await reject(1, {operation: 'OFFER', sessionId, expectedRevision: stale, offer: offers[1]});
    response = await trade(1, {operation: 'OFFER', sessionId, expectedRevision: revision, offer: offers[1]});
    revision = response.session!.revision;
    if (!directedTail) {
    response = await trade(0, {operation: 'SHOW', sessionId, expectedRevision: revision});
    revision = response.session!.revision;
    response = await trade(0, {operation: 'UNSHOW', sessionId, expectedRevision: revision});
    revision = response.session!.revision;
    assert(response.session!.parties.every(party => !party.shown && !party.confirmed));
    await reject(0, {operation: 'CONFIRM', sessionId, expectedRevision: revision});
    }
    for (const index of [0, 1]) {
      response = await trade(index, {operation: 'SHOW', sessionId, expectedRevision: revision});
      revision = response.session!.revision;
    }
    assert(response.session!.parties.every(party => party.shown));
    evidence.shown = response.session;
    response = await trade(0, {operation: 'CONFIRM', sessionId, expectedRevision: revision});
    revision = response.session!.revision;
    assert.equal(response.session!.phase, 'OPEN');
    assert.deepEqual(await accounts(), baseline, 'Single confirmation must not settle');
    response = await trade(1, {operation: 'CONFIRM', sessionId, expectedRevision: revision});
    assert.equal(response.session!.phase, 'COMPLETED');
    const settled = await accounts(); evidence.settled = settled;
    for (const [index, account] of settled.entries()) {
      for (const key of ['money', 'originality', 'skillPoints'] as const) {
        assert.equal(account.wallet![key], baseline[index].wallet![key] - offers[index][key] + offers[1 - index][key]);
      }
    }
    assert(!settled[1].owned.base.some(row => fields(row).get(0) === petId));
    assert(!settled[1].owned.equipment.some(row => fields(row).get(0x1c) === tankId));
    const receivedPet = settled[0].owned.base.find(row => JSON.stringify(withoutId(row, 0)) === JSON.stringify(withoutId(pet, 0)))!;
    const receivedTank = settled[0].owned.equipment.find(row => JSON.stringify(withoutId(row, 0x1c)) === JSON.stringify(withoutId(tank, 0x1c)))!;
    assert(receivedPet && receivedTank, 'Complete pet ranks and tank remaining minutes must survive');
    assert.notEqual(fields(receivedPet).get(0), petId, 'The donor pet ID collides with a recipient item');
    assert.notEqual(fields(receivedTank).get(0x1c), tankId, 'The donor tank ID collides with a recipient item');
    assert.deepEqual(withoutId(receivedPet, 0), withoutId(pet, 0));
    assert.deepEqual(withoutId(receivedTank, 0x1c), withoutId(tank, 0x1c));
    assert.equal(fields(receivedPet).get(0x6c), 1);
    assert.equal(settled[0].inventory.records.filter(row => row.itemTableId === 1).length, 1);
    assert.equal(settled[0].inventory.records.find(row => row.itemTableId === 1)!.ownedQuantity, 4);
    assert.equal(settled[0].inventory.records.find(row => row.itemTableId === 1)!.instanceId, recipientStack.instanceId);
    assert.equal(settled[1].inventory.records.find(row => row.instanceId === donorStack.instanceId)!.ownedQuantity, 3);
    const donorProfile = new DataView(Uint8Array.from(settled[1].profile!.bytes).buffer);
    assert.equal(donorProfile.getUint32(0xa4, true), 0);
    assert.equal(donorProfile.getUint32(0xa8, true), 0);
    evidence.received = {pet: receivedPet, tank: receivedTank, partialStack: {donor: 3, recipient: 4}};
    if (!directedTail) {
      response = await trade(0, {operation: 'CONFIRM', sessionId, expectedRevision: revision});
      assert.equal(response.session!.phase, 'COMPLETED');
      assert.deepEqual(await accounts(), settled, 'Repeated confirmation must not debit twice');
    }
    await wait(() => messages.every(rows => rows.some(row => row.state.session?.id === sessionId && row.state.session.phase === 'COMPLETED')));
    const completed = messages.map(rows => rows.findLast(row => row.state.session?.id === sessionId && row.state.session.phase === 'COMPLETED')!);
    assert.deepEqual(completed[0].state.session, completed[1].state.session);
    for (const [index, row] of completed.entries()) assert.deepEqual(row.state.account, settled[index]);
    evidence.dualCompleted = completed;

    const selections = [];
    for (const [kind, instanceId] of [['pet', fields(receivedPet).get(0)!], ['tank', fields(receivedTank).get(0x1c)!]] as const) {
      selections.push(await must(clients[0].callApi('SelectRole', {kind, instanceId})));
    }
    evidence.receivedSelections = selections;
    const donorPet = settled[1].owned.base[0], donorTank = settled[1].owned.equipment[0];
    assert(donorPet && donorTank, 'The donor normally selects its remaining owned roles after transfer clears selection');
    evidence.donorSelections = [
      await must(clients[1].callApi('SelectRole', {kind: 'pet', instanceId: fields(donorPet).get(0)!})),
      await must(clients[1].callApi('SelectRole', {kind: 'tank', instanceId: fields(donorTank).get(0x1c)!})),
    ];
    const base = {name: receivedPet.name, fields: fields(receivedPet)};
    const equipment = {name: receivedTank.name, fields: fields(receivedTank)};
    const bound = freezeSelectedBoundSource(base)!; assert(bound);
    const tankTable = TANKS.find(row => row.id === equipment.fields.get(0x24))!;
    const petTable = PET_BASES.find(row => row.id === base.fields.get(8))!;
    const combat = createRoleCombatState();
    for (const skillId of combatItemSkills.get(2001)!.skillIds) if (skillId) combat.addSkill(skillId);
    const sources = readRoleSkillSources({currentSkillIds: [...combat.record!.arrays.get(4)!], boundGear: bound,
      equipment, roleFields: combat.attributeSourceFields()!});
    const expectedMovement = recomputeQualifiedRoleMovement({tank: tankTable.recomputeBase, pet: petTable,
      ownedField34: equipment.fields.get(0x34), tankType: tankTable.recomputeBase.tankType, sources,
      skills: combatSkills, items: combatItemSkills, limits: combatLimits,
      roleValue9: combat.recomputeCounter, movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
    assert(expectedMovement);
    const expectedSources = {currentSkillIds: [...sources.currentSkillIds!], equipmentSkills: sources.equipmentSkills!,
      selectedSkillIds: selectRoleSkills(sources, combatSkills, combatItemSkills).map(skill => skill.skillId)};
    assert(expectedSources.selectedSkillIds.includes(10251));
    const created = await must(clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: '交易取得被动来源',
      name: 'Recipient', tankId: 52, minPlayers: 2, maxPlayers: 2}));
    const joined = await must(clients[1].callApi('Join', {roomId: created.room.id,
      clientId: 'ignored', name: 'Donor', tankId: fields(donorTank).get(0x24)!}));
    const targetId = created.playerId;
    const latest = () => frames[0].at(-1)!.snapshot;
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.players.some(row => row.id === targetId)));
    for (const rows of frames) assert.deepEqual(rows.at(-1)!.snapshot.players.find(row => row.id === targetId)!.roleSkillSources, expectedSources);
    evidence.receivedRoom = {created, joined, expectedSources, expectedMovement, boundSource: [...bound.fields]};
    for (const client of clients) await must(client.callApi('Ready', {round: 1}));
    await wait(() => frames.every(rows => rows.at(-1)?.snapshot.phase === 'PLAYING'));
    const input = {sequence: 1, move: 1, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: Date.now()};
    assert((await clients[0].sendMsg('PlayerInput', input)).isSucc);
    const startTick = latest().tick;
    await wait(() => latest().tick >= startTick + 7);
    const stopInput = {...input, sequence: 2, move: 0, clientTime: Date.now()};
    assert((await clients[0].sendMsg('PlayerInput', stopInput)).isSucc);
    const sampled = frames[0].filter(row => row.snapshot.phase === 'PLAYING'
      && row.snapshot.tick >= startTick + 1 && row.snapshot.tick <= startTick + 6);
    assert.equal(sampled.length, 6);
    const first = sampled[0], last = sampled.at(-1)!;
    const a = first.snapshot.players.find(row => row.id === targetId)!;
    const b = last.snapshot.players.find(row => row.id === targetId)!;
    assert.equal(a.tankId, 52); assert.equal(a.petId, 2);
    const simulatedSeconds = (last.snapshot.tick - first.snapshot.tick) * .05;
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    assert(Math.abs(distance / simulatedSeconds - expectedMovement.speed) < .05);
    const key = (snapshot: MsgRoomSnapshot) => `${snapshot.roomId}/${snapshot.match?.round}/${snapshot.phase}/${snapshot.tick}`;
    const peer = new Map(frames[1].map(row => [key(row.snapshot), row.snapshot]));
    const common = frames[0].filter(row => peer.has(key(row.snapshot)));
    for (const row of common) assert.deepEqual(row.snapshot.players, peer.get(key(row.snapshot))!.players);
    assert(common.length >= 6);
    assert(!events[0].some(event => event.type === 'fire'));
    evidence.receivedMovement = {input, stopInput, distance, simulatedSeconds,
      serverSeconds: (last.snapshot.serverTime - first.snapshot.serverTime) / 1000,
      wallSeconds: (last.wallTime - first.wallTime) / 1000,
      commonKeys: [...new Set(common.map(row => key(row.snapshot)))]};
    evidence.leave = [];
    for (const client of clients) (evidence.leave as unknown[]).push(await must(client.callApi('Leave', {roomId: created.room.id, round: 1})));
    const finalAccounts = await accounts(); evidence.finalAccounts = finalAccounts;
    for (const [index, account] of finalAccounts.entries()) {
      assert.deepEqual(account.wallet, settled[index].wallet);
      assert.deepEqual(account.owned, settled[index].owned);
    }
    for (const client of clients) await client.disconnect(); await stop();
    const native = new DatabaseSync(database, {readOnly: true});
    try {
      const receipts = native.prepare('SELECT session_id, account_a, account_b, receipt FROM trade_receipts').all();
      assert.equal(receipts.length, 1); assert.equal(receipts[0].session_id, sessionId);
      const nativeAccounts = identities.map(identity => ({
        profile: [...new Uint8Array(native.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(identity.accountId)!.payload as Uint8Array)],
        roles: native.prepare('SELECT kind, record FROM role_records WHERE account_id = ? ORDER BY instance_id').all(identity.accountId),
        inventory: native.prepare('SELECT record FROM inventory WHERE account_id = ? ORDER BY instance_id').all(identity.accountId),
      }));
      for (const [index, row] of nativeAccounts.entries()) assert.deepEqual(row.profile, finalAccounts[index].profile!.bytes);
      evidence.native = {receipts, accounts: nativeAccounts};
    } finally {native.close();}
    await start(); await authenticate();
    const restored = await accounts(); assert.deepEqual(restored, finalAccounts);
    evidence.restored = restored; evidence.actualSameDatabaseRestart = true;
    evidence.status = 'PASS_FINITE_TRADE_SESSION_SCALARS_PARTIAL_STACK_OWNED_RECORDS_DUAL_STATE_RESTART_SCOPE';
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    for (const client of clients) await client.disconnect(); await stop();
    if (existsSync(database)) {
      const preserved = new DatabaseSync(database, {readOnly: true});
      try {await backup(preserved, output + '-checkpoint.sqlite');}
      finally {preserved.close();}
      writeFileSync(output + '-identity.private.json', JSON.stringify({accounts: identities}) + '\n', {mode: 0o600});
      evidence.checkpoint = output + '-checkpoint.sqlite';
      evidence.checkpointFromActualFinallyDatabase = true;
    }
    rmSync(directory, {recursive: true, force: true});
    evidence.cleaned = true; evidence.messages = messages; evidence.calls = calls;
    evidence.frames = frames; evidence.events = events;
    writeFileSync(output + '.json', JSON.stringify(evidence, null, 2) + '\n');
    writeFileSync(output + '-server.log', log);
  }
  console.log('PASS: ' + output + '.json');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
