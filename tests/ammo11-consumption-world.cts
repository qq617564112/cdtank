import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {World} from '../apps/server/src/world';
import {AccountStore} from '../apps/server/src/account-store';
import {consumeConfirmedAmmo} from '../apps/server/src/battle/items/ammo-consumption';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';
import type {MsgPlayerInput, MsgRoomEvent} from '../apps/shared/protocols';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-ammo11-'));
const store = new AccountStore(join(directory, 'accounts.sqlite'));
const item: InventoryWireRecord = {instanceId: 77, itemTableId: 2011, ownedQuantity: 2,
  battleQuantity: 88, state: 0, field8: 7, float24Bits: 0x7fc01234, float28Bits: 0x80000000, float2cBits: 0xffffffff};
const idle: MsgPlayerInput = {sequence: 0, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: 0};
try {
  const account = store.open(), other = store.open();
  store.replaceInventory(account.accountId, [item]);
  store.replaceInventory(other.accountId, [item]);
  store.assign(account.accountId, 77, 1);
  let now = 100000;
  let mode: 'success' | 'false' | 'throw' = 'false';
  const calls: number[] = [];
  const world = new World(() => now, {timeLimitSeconds: 20, consumeItem: (_player, instance, owned, table) => {
    calls.push(owned);
    if (mode === 'throw') throw new Error('Storage boundary fixture');
    if (mode === 'false') return false;
    return store.consumeItem(account.accountId, instance, owned, table);
  }});
  const joined = world.createAndJoin('ammo11', 4, 7, 'Ammo11', 'Player', 1);
  world.bindInventory(joined.playerId, store.inventory(account.accountId));
  world.ready(joined.playerId, 1);
  let sequence = 0;
  const key = (useItem = 0, fire = true) => world.updateInput(joined.playerId,
    {...idle, sequence: ++sequence, useItem, fire, clientTime: now});
  const snap = () => world.snapshot(joined.roomId)!.players[0];
  const step = (dt = 50) => {now += dt; return world.step(dt).events;};
  key(2, false);
  assert.equal(snap().ammoItemId, 2011);
  const initial = world.inventory(joined.playerId);
  const rejected: MsgRoomEvent[] = [];
  for (const failure of ['false', 'throw'] as const) {
    mode = failure;
    const reload = {...snap().reload!};
    key();
    const events = step();
    assert.equal(events.filter(event => event.type === 'fire').length, 0);
    assert.equal(events.filter(event => event.type === 'ammoConsumed').length, 0);
    assert.equal(events.filter(event => event.type === 'itemRejected').length, 1);
    assert.deepEqual(snap().reload, reload);
    assert.equal(snap().ammoItemId, 2011);
    assert.deepEqual(world.inventory(joined.playerId), initial);
    assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 2);
    assert.deepEqual(step(1000), [], 'Rejected held input cannot auto retry persistence');
    rejected.push(...events);
  }
  mode = 'success';
  const shots: MsgRoomEvent[] = [];
  key();
  for (let expected = 1; expected >= 0; expected--) {
    let events: MsgRoomEvent[] = [];
    for (let tick = 0, limit = Math.ceil(snap().reload!.duration * 1000 / 50) + 2; tick < limit && !events.some(event => event.type === 'fire'); tick++) events.push(...step());
    const fire = events.find(event => event.type === 'fire')!;
    assert(fire);
    assert.equal(fire.skillId, 2011);
    assert.equal(fire.shotDisplay!.itemId, 2011);
    assert.equal(events.find(event => event.type === 'ammoConsumed')!.value, expected);
    assert(events.findIndex(event => event.type === 'ammoConsumed') < events.findIndex(event => event.type === 'fire'));
    assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, expected);
    assert.equal(world.inventory(joined.playerId).records[0].ownedQuantity, expected);
    assert.equal(world.inventory(joined.playerId).records[0].battleQuantity, expected);
    assert.equal(snap().ammoItemId, 2011, 'Last valid shot cannot change2011 before its event');
    shots.push(fire);
  }
  const callsBeforeEmpty = calls.length;
  const reload = snap().reload!.startedAt;
  let exhausted: MsgRoomEvent[] = [];
  for (let tick = 0, limit = Math.ceil(snap().reload!.duration * 1000 / 50) + 2; tick < limit && !exhausted.some(event => event.type === 'itemRejected'); tick++) exhausted.push(...step());
  assert.equal(exhausted.filter(event => event.type === 'fire').length, 0);
  assert.equal(snap().ammoItemId, 2001);
  assert.equal(snap().selectedAmmoSlot, 1);
  assert.equal(snap().reload!.startedAt, reload);
  assert.equal(calls.length, callsBeforeEmpty);
  assert.deepEqual(step(1000), [], 'Exhausted held input cannot start default fire');
  key();
  const defaultShot = step().find(event => event.type === 'fire')!;
  assert.equal(defaultShot.skillId, 2001);
  assert.equal(calls.length, callsBeforeEmpty);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 0);
  assert.deepEqual(store.inventory(other.accountId).records, [item]);
  const persisted = store.inventory(account.accountId).records[0];
  assert.deepEqual(persisted, {...item, ownedQuantity: 0});
  world.leave(joined.playerId);

  // CPU/no-account fixture uses the same finite in-memory authority.
  const combat = createRoleCombatState();
  combat.setStatus(2); combat.setSelectedAmmoSlot(2); combat.setCurrentAmmoTableId(2011);
  combat.record!.arrays.get(0)![0] = 77;
  const player = {id: 'cpu-fixture', x: 0, y: 0, z: 0, combat,
    inventory: [{...item, ownedQuantity: 1, battleQuantity: 1}], input: {...idle, fire: true}};
  const memoryEvents: MsgRoomEvent[] = [];
  assert(consumeConfirmedAmmo('fixture', player, undefined, memoryEvents));
  assert.equal(player.inventory[0].ownedQuantity, 0);
  assert.equal(player.inventory[0].battleQuantity, 0);
  assert.equal(combat.currentAmmoTableId, 2011);
  assert(!consumeConfirmedAmmo('fixture', player, undefined, memoryEvents));
  assert.equal(combat.currentAmmoTableId, 2001);
  assert.equal(player.input.fire, false);
  writeFileSync('recovery/output/ammo11-consumption-world.json', JSON.stringify({status: 'PASS',
    scope: 'Rebuilt2011 finite ordinary World held fire: CASfalse/throw no shot/reload/count changes, two durable commits, last shot2011, empty rejection/default switch/held stop and explicit new default input. Other-account and original fields preserved. Explicit no-account memory fixture. No original producer claim.',
    calls, shots, rejected, exhausted, defaultShot, persisted, memoryEvents}, null, 2) + '\n');
  console.log('PASS:2011 CAS-first two shots/finite memory, save failures, exhaustion and held/default semantics');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
