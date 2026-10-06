import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {AccountStore} from '../apps/server/src/account-store';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';
import {writeRoleProfileEquipment} from '../apps/server/src/accounts/profile/equipment';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {ResOwnedRoles} from '../apps/shared/protocols/PtlOwnedRoles';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-account-network-'));
  const database = join(directory, 'accounts.sqlite');
  const store = new AccountStore(database);
  const owner = store.open(), other = store.open();
  const instanceId = 0xf1234567;
  store.replaceInventory(owner.accountId, [{instanceId, itemTableId: 2001, ownedQuantity: 5,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0xffffffff, float28Bits: 0x80000000, float2cBits: 0},
    {instanceId: instanceId + 1, itemTableId: 3001, ownedQuantity: 3, battleQuantity: 0,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0},
    {instanceId: instanceId + 2, itemTableId: 1, ownedQuantity: 30, battleQuantity: 0,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]);
  store.close();
  let server: ChildProcess | undefined;
  let log = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3129', logger: undefined}));
  let latestSnapshot: MsgRoomSnapshot | undefined;
  clients[0].listenMsg('RoomSnapshot', state => {latestSnapshot = state;});
  async function waitTank(id: string, tankId: number, phase = 'WAITING'): Promise<void> {
    const deadline = Date.now() + 3000;
    while (!(latestSnapshot?.phase === phase && latestSnapshot.players.some(p => p.id === id && p.tankId === tankId))
        && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(latestSnapshot?.phase, phase);
    assert.equal(latestSnapshot?.players.find(p => p.id === id)?.tankId, tankId);
  }
  async function waitReady(id: string, ready: boolean): Promise<void> {
    const deadline = Date.now() + 3000;
    while (latestSnapshot?.match?.readyPlayerIds.includes(id) !== ready && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(latestSnapshot?.match?.readyPlayerIds.includes(id), ready);
  }
  async function start(): Promise<void> {
    log = '';
    const entry = process.env.CDTANK_SERVER_ENTRY;
    server = spawn(process.execPath, entry ? [entry] : ['--import', 'tsx', 'apps/server/src/index.ts'], {
      cwd: process.env.CDTANK_SERVER_CWD ?? process.cwd(),
      env: {...process.env, PORT: '3129', ACCOUNT_DB_PATH: database}, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', data => {log += String(data);});
    server.stderr!.on('data', data => {log += String(data);});
    const deadline = Date.now() + 15000;
    while (!log.includes('Server started') && Date.now() < deadline && server.exitCode === null) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert(log.includes('Server started'), log);
    for (const client of clients) assert((await client.connect()).isSucc);
  }
  async function stop(): Promise<void> {
    for (const client of clients) await client.disconnect();
    if (server && server.exitCode === null) {
      const ended = new Promise<void>(resolve => server!.once('exit', () => resolve()));
      server.kill(); await ended;
    }
  }
  try {
    await start();
    assert(!(await clients[0].callApi('Equipment', {operation: 'QUERY'})).isSucc);
    assert(!(await clients[0].callApi('Inventory', {})).isSucc);
    assert(!(await clients[0].callApi('RoleProfile', {})).isSucc);
    assert(!(await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: 1})).isSucc);
    assert(!(await clients[0].callApi('OwnedRoles', {})).isSucc);
    assert(!(await clients[0].callApi('Account', {token: 'invalid'})).isSucc);
    const account = await clients[0].callApi('Account', {token: owner.token});
    assert(account.isSucc); assert.equal(account.res.accountId, owner.accountId);
    assert((await clients[1].callApi('Account', {token: other.token})).isSucc);
    assert(!(await clients[1].callApi('Kitbag', {operation: 'ASSIGN', instanceId, slot: 1})).isSucc);
    assert(!(await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId, slot: 4})).isSucc);
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId, slot: 1})).isSucc);
    const inventory = await clients[0].callApi('Inventory', {});
    assert(inventory.isSucc); assert.equal(inventory.res.hotkeys[0], instanceId);
    assert.equal(inventory.res.records[0].float24Bits, 0xffffffff);
    const empty = await clients[1].callApi('Inventory', {});
    assert(empty.isSucc); assert.deepEqual(empty.res.records, []);
    const freshRoles = await clients[0].callApi('OwnedRoles', {});
    assert(freshRoles.isSucc); assert.deepEqual(freshRoles.res, {base: [], equipment: []});
    const pairEvidence: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(
      readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
    const freshProfile = await clients[0].callApi('RoleProfile', {});
    assert(freshProfile.isSucc); assert.deepEqual(freshProfile.res, {});
    assert(!(await clients[0].callApi('SelectRole', {kind: 'pet', instanceId: 1})).isSucc);
    const profileEvidence: {updates: {code: number; profile: number[]; strings: number[][]}[]} = JSON.parse(
      readFileSync('recovery/output/role-profile-update-native.json', 'utf8'));
    let expectedProfile: {bytes: number[]; strings: [string, string]} | undefined;
    let nativeProfiles = 0;
    let expectedRoles: ResOwnedRoles = {base: [], equipment: []};
    const writer = new AccountStore(database);
    try {
      for (const row of profileEvidence.updates.filter(row => row.code === 1)) {
        expectedProfile = {bytes: row.profile,
          strings: row.strings.map(bytes => Buffer.from(bytes).toString('latin1')) as [string, string]};
        writer.replaceRoleProfile(owner.accountId, {bytes: new Uint8Array(expectedProfile.bytes), strings: expectedProfile.strings});
        const live = await clients[0].callApi('RoleProfile', {});
        assert(live.isSucc); assert.deepEqual(live.res, {profile: expectedProfile});
        const isolated = await clients[1].callApi('RoleProfile', {});
        assert(isolated.isSucc); assert.deepEqual(isolated.res, {});
        nativeProfiles++;
      }
      writer.replaceRoleProfile(other.accountId, {bytes: new Uint8Array(expectedProfile!.bytes),
        strings: ['另一账户资料', '另一宠物']});
      const otherProfile = await clients[1].callApi('RoleProfile', {});
      assert(otherProfile.isSucc); assert.deepEqual(otherProfile.res.profile?.strings, ['另一账户资料', '另一宠物']);
      const ownerProfile = await clients[0].callApi('RoleProfile', {});
      assert(ownerProfile.isSucc); assert.deepEqual(ownerProfile.res, {profile: expectedProfile});
      for (const row of pairEvidence.rows) {
        const pair = readOwnedRolePairMessage(new Uint8Array(row.raw), row.alignment,
          bytes => Buffer.from(bytes).toString('hex'));
        writer.replaceRoleRecords(owner.accountId, {base: [pair.base], equipment: [pair.equipment]});
        expectedRoles = {base: [{name: pair.base.name, fields: [...pair.base.fields]}],
          equipment: [{name: pair.equipment.name, fields: [...pair.equipment.fields]}]};
        for (const [kind, id, offset] of [['pet', pair.base.fields.get(0)!, 0xa4],
          ['tank', pair.equipment.fields.get(0x1c)!, 0xa8]] as const) {
          const selection = await clients[0].callApi('SelectRole', {kind, instanceId: id});
          assert(selection.isSucc);
          const updated = new Uint8Array(expectedProfile!.bytes);
          new DataView(updated.buffer).setUint32(offset, id, true);
          expectedProfile = {bytes: [...updated], strings: expectedProfile!.strings};
          assert.deepEqual(selection.res, {code: kind === 'pet' ? 0 : 1, profile: expectedProfile});
          assert(!(await clients[1].callApi('SelectRole', {kind, instanceId: id})).isSucc);
        }
        const live = await clients[0].callApi('OwnedRoles', {});
        assert(live.isSucc); assert.deepEqual(live.res, expectedRoles);
        const isolated = await clients[1].callApi('OwnedRoles', {});
        assert(isolated.isSucc); assert.deepEqual(isolated.res, {base: [], equipment: []});
      }
      writer.replaceRoleRecords(other.accountId, {
        base: expectedRoles.base.map(record => ({name: '另一账户', fields: new Map(record.fields)})),
        equipment: expectedRoles.equipment.map(record => ({name: '另一账户装备', fields: new Map(record.fields)})),
      });
      const isolated = await clients[1].callApi('OwnedRoles', {});
      assert(isolated.isSucc); assert.equal(isolated.res.base[0].name, '另一账户');
      const unchanged = await clients[0].callApi('OwnedRoles', {});
      assert(unchanged.isSucc); assert.deepEqual(unchanged.res, expectedRoles);
      // Explicit room assembly: native ownership layout with actual TankTable definitions.
      const equipment = expectedRoles.equipment.map(record => ({name: record.name, fields: new Map(record.fields)}));
      equipment[0].fields.set(0x24, 0xffffffff);
      writer.replaceRoleRecords(owner.accountId, {base: expectedRoles.base.map(r => ({name: r.name, fields: new Map(r.fields)})), equipment});
      const beforeRooms = await clients[0].callApi('ListRooms', {});
      for (const [api, req] of [
        ['CreateRoom', {mode: 4, mapId: 7, roomName: 'Invalid', name: 'Owner', tankId: 1}],
        ['Join', {clientId: 'owner-fixture', roomId: 'R1', name: 'Owner', tankId: 1}],
        ['QuickMatch', {clientId: 'owner-fixture', name: 'Owner', tankId: 1}],
      ] as const) assert(!(await clients[0].callApi(api, req)).isSucc);
      assert.deepEqual(await clients[0].callApi('ListRooms', {}), beforeRooms);
      equipment[0].fields.set(0x24, 2);
      writer.replaceRoleRecords(owner.accountId, {base: expectedRoles.base.map(r => ({name: r.name, fields: new Map(r.fields)})), equipment});
      expectedRoles.equipment = equipment.map(r => ({name: r.name, fields: [...r.fields]}));
      const quick = await clients[0].callApi('QuickMatch', {clientId: 'owner-fixture', name: 'Owner', tankId: 1});
      assert(quick.isSucc);
      const deadline = Date.now() + 3000;
      while (latestSnapshot?.roomId !== quick.res.roomId && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(latestSnapshot?.players.find(p => p.name === 'Owner')?.tankId, 2);
    } finally {writer.close();}
    await stop(); await start();
    assert(!(await clients[0].callApi('OwnedRoles', {})).isSucc);
    assert(!(await clients[0].callApi('RoleProfile', {})).isSucc);
    assert((await clients[0].callApi('Account', {token: owner.token})).isSucc);
    const restored = await clients[0].callApi('Inventory', {});
    assert(restored.isSucc); assert.deepEqual(restored.res, inventory.res);
    const restoredProfile = await clients[0].callApi('RoleProfile', {});
    assert(restoredProfile.isSucc); assert.deepEqual(restoredProfile.res, {profile: expectedProfile});
    const restoredRoles = await clients[0].callApi('OwnedRoles', {});
    assert(restoredRoles.isSucc); assert.deepEqual(restoredRoles.res, expectedRoles);
    const room = await clients[0].callApi('CreateRoom', {mode: 4, mapId: 7, roomName: 'Inventory network', name: 'Owner', tankId: 1});
    assert(room.isSucc);
    assert.equal(room.res.room.players.find(p => p.id === room.res.playerId)?.tankId, 2);
    await waitTank(room.res.playerId, 2);
    const roomWriter = new AccountStore(database);
    const chosen = {name: expectedRoles.equipment[0].name, fields: new Map(expectedRoles.equipment[0].fields)};
    const alternateId = 0xfffffffe;
    const alternate = {name: 'Explicit alternate tank', fields: new Map(chosen.fields)};
    alternate.fields.set(0x1c, alternateId); alternate.fields.set(0x24, 105);
    const invalid = {name: 'Explicit unknown definition', fields: new Map(chosen.fields)};
    invalid.fields.set(0x1c, 0xfffffffd); invalid.fields.set(0x24, 0xffffffff);
    const alternatePet = {name: 'Explicit alternate pet', fields: new Map(expectedRoles.base[0].fields)};
    alternatePet.fields.set(0, 0xfffffffc); alternatePet.fields.set(8, 1);
    try {
      roomWriter.replaceRoleRecords(owner.accountId, {base: [...expectedRoles.base.map(r => ({name: r.name, fields: new Map(r.fields)})), alternatePet],
        equipment: [chosen, alternate, invalid]});
      assert(!(await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: 0xfffffffd})).isSucc);
      const retained = await clients[0].callApi('RoleProfile', {});
      assert(retained.isSucc); assert.deepEqual(retained.res, {profile: expectedProfile});
      await waitTank(room.res.playerId, 2);
      roomWriter.replaceRoleRecords(other.accountId, {base: [], equipment: [chosen]});
      const otherBytes = new Uint8Array(expectedProfile!.bytes);
      new DataView(otherBytes.buffer).setUint32(0xa8, chosen.fields.get(0x1c)!, true);
      roomWriter.replaceRoleProfile(other.accountId, {bytes: otherBytes, strings: ['另一账户资料', '另一宠物']});
      assert((await clients[1].callApi('Account', {token: other.token})).isSucc);
      const guest = await clients[1].callApi('Join', {clientId: 'guest-fixture', roomId: room.res.room.id, name: 'Guest', tankId: 1});
      assert(guest.isSucc);
      assert.equal(guest.res.room.players.find(p => p.id === guest.res.playerId)?.tankId, 2);
      assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
      const readyDeadline = Date.now() + 3000;
      while (!latestSnapshot?.match?.readyPlayerIds.includes(room.res.playerId) && Date.now() < readyDeadline) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert(latestSnapshot?.match?.readyPlayerIds.includes(room.res.playerId));
      assert((await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: alternateId})).isSucc);
      const changed = new Uint8Array(expectedProfile!.bytes);
      new DataView(changed.buffer).setUint32(0xa8, alternateId, true);
      expectedProfile = {bytes: [...changed], strings: expectedProfile!.strings};
      await waitTank(room.res.playerId, 105);
      assert(!latestSnapshot!.match!.readyPlayerIds.includes(room.res.playerId));
      assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
      await waitReady(room.res.playerId, true);
      assert((await clients[0].callApi('SelectRole', {kind: 'pet', instanceId: alternatePet.fields.get(0)!})).isSucc);
      await waitReady(room.res.playerId, false);
      new DataView(changed.buffer).setUint32(0xa4, alternatePet.fields.get(0)!, true);
      expectedProfile = {bytes: [...changed], strings: expectedProfile!.strings};
      assert.equal(latestSnapshot!.players.find(player => player.id === room.res.playerId)!.tankId, 105);
      expectedRoles.base.push({name: alternatePet.name, fields: [...alternatePet.fields]});
      expectedRoles.base.sort((a, b) => a.fields.find(([offset]) => offset === 0)![1] - b.fields.find(([offset]) => offset === 0)![1]);
      expectedRoles.equipment.push({name: alternate.name, fields: [...alternate.fields]}, {name: invalid.name, fields: [...invalid.fields]});
      expectedRoles.equipment.sort((a, b) => a.fields.find(([offset]) => offset === 0x1c)![1] - b.fields.find(([offset]) => offset === 0x1c)![1]);
    } finally {roomWriter.close();}
    await clients[1].disconnect();
    assert(!(await clients[0].callApi('Account', {token: other.token})).isSucc);
    const inRoomProfile = await clients[0].callApi('RoleProfile', {});
    assert(inRoomProfile.isSucc); assert.deepEqual(inRoomProfile.res, {profile: expectedProfile});
    const inRoomRoles = await clients[0].callApi('OwnedRoles', {});
    assert(inRoomRoles.isSucc); assert.deepEqual(inRoomRoles.res, expectedRoles);
    assert((await clients[0].callApi('Kitbag', {operation: 'CANCEL', slot: 1})).isSucc);
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId, slot: 1})).isSucc);
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId: instanceId + 1, slot: 2})).isSucc);
    assert((await clients[0].callApi('Kitbag', {operation: 'ASSIGN', instanceId: instanceId + 2, slot: 4})).isSucc);
    const equipmentWriter = new AccountStore(database);
    try {
      const owned = equipmentWriter.roleRecords(owner.accountId);
      for (const record of owned.equipment.values()) {
        const fields = record.fields as Map<number, number>;
        fields.set(0x6c, 3);
        for (const offset of [0x58, 0x5c, 0x60]) fields.set(offset, 0);
      }
      for (const record of owned.base.values()) {
        const fields = record.fields as Map<number, number>;
        for (let index = 0; index < 6; index++) {fields.set(0x44 + index * 4, 0); fields.set(0x5c + index * 4, 0);}
      }
      equipmentWriter.replaceRoleRecords(owner.accountId, {base: [...owned.base.values()], equipment: [...owned.equipment.values()]});
      const profile = equipmentWriter.roleProfile(owner.accountId)!;
      writeRoleProfileEquipment(profile, [0, 0, 0, 0, 0]); equipmentWriter.replaceRoleProfile(owner.accountId, profile);
      const original = equipmentWriter.inventory(owner.accountId).records;
      equipmentWriter.replaceInventory(owner.accountId, [...original, {instanceId: 81, itemTableId: 13001,
        ownedQuantity: 1, battleQuantity: 1, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0},
        ...[10001, 12001].map((itemTableId, index) => ({instanceId: 82 + index, itemTableId,
          ownedQuantity: 1, battleQuantity: 1, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}))]);
    } finally {equipmentWriter.close();}
    assert((await clients[1].connect()).isSucc);
    assert((await clients[1].callApi('Account', {token: other.token})).isSucc);
    assert((await clients[1].callApi('Join', {clientId: 'equipment-observer', roomId: room.res.room.id,
      name: 'Equipment observer', tankId: 1})).isSucc);
    const partQuery = await clients[0].callApi('Equipment', {operation: 'QUERY'});
    assert(partQuery.isSucc); assert.equal(partQuery.res.slotCount, 3);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    await waitReady(room.res.playerId, true);
    assert((await clients[0].callApi('Equipment', {operation: 'QUERY'})).isSucc);
    await waitReady(room.res.playerId, true);
    const partEquipped = await clients[0].callApi('Equipment', {operation: 'EQUIP', slot: 0, instanceId: 81});
    assert(partEquipped.isSucc); assert.deepEqual(partEquipped.res.slots, [81, 0, 0, 0, 0]);
    await waitReady(room.res.playerId, false);
    expectedProfile = partEquipped.res.profile;
    for (const [target, instanceId] of [['DECORATION', 82], ['MARK', 83]] as const) {
      assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
      await waitReady(room.res.playerId, true);
      const equipped = await clients[0].callApi('Equipment', {operation: 'EQUIP', target, instanceId});
      assert(equipped.isSucc);
      await waitReady(room.res.playerId, false);
      assert.equal(target === 'DECORATION' ? equipped.res.decorationInstanceId : equipped.res.markInstanceId, instanceId);
      assert(!(await clients[1].callApi('Equipment', {operation: 'EQUIP', target, instanceId})).isSucc);
      assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
      await waitReady(room.res.playerId, true);
      const removed = await clients[0].callApi('Equipment', {operation: 'UNEQUIP', target});
      assert(removed.isSucc);
      await waitReady(room.res.playerId, false);
      assert.equal(target === 'DECORATION' ? removed.res.decorationInstanceId : removed.res.markInstanceId, 0);
      const restored = await clients[0].callApi('Equipment', {operation: 'EQUIP', target, instanceId});
      assert(restored.isSucc); expectedProfile = restored.res.profile;
    }
    const partInventory = await clients[0].callApi('Inventory', {});
    assert(partInventory.isSucc); assert.equal(partInventory.res.records.find(r => r.instanceId === 81)!.state, 2);
    for (let index = 0; index < 3; index++) assert((await clients[0].callApi('Cpu', {round: 1, operation: 'ADD', tankId: 1})).isSucc);
    assert((await clients[0].callApi('Ready', {round: 1})).isSucc);
    assert((await clients[1].callApi('Ready', {round: 1})).isSucc);
    await waitTank(room.res.playerId, 105, 'PLAYING');
    assert(!(await clients[0].callApi('SelectRole', {kind: 'tank', instanceId: expectedRoles.equipment[0].fields.find(([offset]) => offset === 0x1c)![1]})).isSucc);
    assert(!(await clients[0].callApi('SelectRole', {kind: 'pet', instanceId: alternatePet.fields.get(0)!})).isSucc);
    const playingProfile = await clients[0].callApi('RoleProfile', {});
    assert(playingProfile.isSucc); assert.deepEqual(playingProfile.res, {profile: expectedProfile});
    assert(!(await clients[0].callApi('Equipment', {operation: 'UNEQUIP', slot: 0})).isSucc);
    assert(!(await clients[0].callApi('Equipment', {operation: 'UNEQUIP', target: 'DECORATION'})).isSucc);
    assert(!(await clients[0].callApi('Equipment', {operation: 'UNEQUIP', target: 'MARK'})).isSucc);
    const playingEquipment = await clients[0].callApi('Equipment', {operation: 'QUERY'});
    assert(playingEquipment.isSucc); assert.deepEqual(playingEquipment.res.slots, [81, 0, 0, 0, 0]);
    assert(!(await clients[0].callApi('Kitbag', {operation: 'CANCEL', slot: 1})).isSucc);
    let ammoSlot = 0;
    clients[0].listenMsg('RoomSnapshot', state => {
      ammoSlot = state.players.find(player => player.id === room.res.playerId)?.selectedAmmoSlot ?? 0;
    });
    assert((await clients[0].sendMsg('PlayerInput', {sequence: 1, move: 0, turn: 0, aim: 0, fire: false, useItem: 2, clientTime: Date.now()})).isSucc);
    const deadline = Date.now() + 3000;
    while (ammoSlot !== 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(ammoSlot, 2);
    const requests: {kind: string; instanceId: number}[] = [];
    clients[0].listenMsg('RoomEvent', event => {if (event.itemUseRequest) requests.push(event.itemUseRequest);});
    for (const [sequence, useItem] of [[2, 3], [3, 3], [4, 5], [4, 5], [5, 5]]) {
      assert((await clients[0].sendMsg('PlayerInput', {sequence, useItem, move: 0, turn: 0,
        aim: 0, fire: false, clientTime: Date.now()})).isSucc);
    }
    const requestDeadline = Date.now() + 3000;
    while (requests.length < 3 && Date.now() < requestDeadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(requests, [{kind: 'placeTrap', instanceId: instanceId + 1},
      {kind: 'useItem', instanceId: instanceId + 2}, {kind: 'useItem', instanceId: instanceId + 2}]);
    const unconsumed = await clients[0].callApi('Inventory', {});
    assert(unconsumed.isSucc); assert.equal(unconsumed.res.records.find(r => r.instanceId === instanceId)!.ownedQuantity, 5);
    assert.equal(unconsumed.res.records.find(r => r.instanceId === instanceId + 2)!.battleQuantity, 10);
    assert.equal(unconsumed.res.records.find(r => r.instanceId === instanceId + 2)!.ownedQuantity, 30);
    writeFileSync('recovery/output/account-network.json', JSON.stringify({status: 'PASS',
      scope: 'Actual rebuilt server account/inventory/kitbag authority, token reconnect, restart persistence, ownership isolation, WAITING configuration and ordinary input ammo selection. Explicit test fixture; no skill cast or stock grants.',
      equipment: {waitingEquip: true, inventoryMarker: true, playingRejects: true, playingQuery: true,
        partEquipClearsReady: true, queryPreservesReady: true, cosmeticEquipUnloadClearsReady: true,
        cosmetics: {equip: true, unload: true, ownershipReject: true, playingRejects: true}},
      restartRecovered: true, selectedAmmoSlot: ammoSlot, ownedQuantity: 5, requests,
      liveCounts: unconsumed.res.records.map(item => item.battleQuantity),
      roleProfile: {nativeProfiles, selectionPairs: pairEvidence.rows.length, selectOwnership: true, playingRejects: true, emptyAccount: true, authentication: true, isolation: true,
        restartRecovery: true, roomQuery: true, petSelectionClearsReady: true, petPlayingRejects: true, roomTankAuthority: {create: 2, join: 2, quickMatch: 2, waitingSelection: 105, playing: 105, invalidDefinitionRetains: true, invalidEntryNoRoomMutation: true, selectionClearsReady: true}},
      ownedRoles: {nativePairs: pairEvidence.rows.length, emptyAccount: true, authentication: true,
        isolation: true, sameInstanceAcrossAccounts: true, restartRecovery: true, roomQuery: true}}, null, 2));
    console.log('PASS: live account APIs, isolated inventory, persisted kitbag across server restart, waiting-stage configuration and ordinary network ammo input');
  } finally {
    await stop(); rmSync(directory, {recursive: true, force: true});
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
