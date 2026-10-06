import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {World} from '../apps/server/src/world';
import {AccountStore} from '../apps/server/src/account-store';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';

const largeFeed = process.argv.includes('--large-feed');
const definitionId = largeFeed ? 2 : 1;
const healingAmount = largeFeed ? 400 : 200;
let sourceCap: {owned: number; battle: number} | undefined;
const directory = mkdtempSync(join(tmpdir(), 'cdtank-healing-'));
let store = new AccountStore(join(directory, 'accounts.sqlite'));
try {
  const account = store.open(), other = store.open();
  const item: InventoryWireRecord = {instanceId: 77, itemTableId: definitionId, ownedQuantity: 4,
    battleQuantity: 88, state: 0, field8: 7, float24Bits: 0x7fc01234,
    float28Bits: 0x80000000, float2cBits: 0xffffffff};
  store.replaceInventory(account.accountId, [item]);
  store.assign(account.accountId, 77, 4);
  let now = 100000;
  let allow = true;
  let storageThrows = false;
  let ownerId = '';
  const commits: {instance: number; owned: number}[] = [];
  const world = new World(() => now, {consumeItem: (playerId, instance, owned, itemTableId) => {
    assert.equal(playerId, ownerId);
    if (storageThrows) throw new Error('Injected storage failure at commit boundary');
    if (!allow) return false;
    commits.push({instance, owned});
    return store.consumeItem(account.accountId, instance, owned, itemTableId);
  }});
  const joined = world.createAndJoin('healing-owner', 4, 7, 'Healing', 'Owner', 1);
  ownerId = joined.playerId;
  if (largeFeed) {
    const source = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows[0];
    const fields = (record: Record<string, number>) => new Map(Object.entries(record).map(([key, value]) => [Number(key), value]));
    const base = fields(source.base);
    // Explicit initial owned-pet fixture, before preparation. Never change live battle health.
    base.set(0x2c, 1000);
    world.bindRoleSources(ownerId, {base: {name: 'Explicit 1000HP owned-pet fixture', fields: base},
      equipment: {name: 'Explicit native tank fixture', fields: fields(source.equipment)}});
    assert(world.roleAttributes(ownerId).ready);
    const capWorld = new World(() => now);
    const capOwner = capWorld.createAndJoin('large-feed-cap', 4, 7, 'Cap', 'Owner', 1);
    capWorld.bindInventory(capOwner.playerId, {hotkeys: [0, 0, 0, 77, 0, 0, 0],
      records: [{...item, ownedQuantity: 8}]});
    capWorld.ready(capOwner.playerId, 1);
    assert.equal(capWorld.inventory(capOwner.playerId).records[0].battleQuantity, 5);
    assert.equal(capWorld.inventory(capOwner.playerId).records[0].ownedQuantity, 8);
    sourceCap = {owned: capWorld.inventory(capOwner.playerId).records[0].ownedQuantity,
      battle: capWorld.inventory(capOwner.playerId).records[0].battleQuantity};
    capWorld.leave(capOwner.playerId);
  }
  world.bindInventory(ownerId, store.inventory(account.accountId));
  for (let i = 0; i < 3; i++) world.manageCpu(ownerId, 1, 'ADD', 1);
  world.ready(ownerId, 1);
  let sequence = 0;
  const key = (seq = ++sequence) => world.updateInput(ownerId,
    {sequence: seq, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: now});
  let checkedHealthStates = 0, deaths = 0, respawns = 0;
  const verifyHealth = (roomId = joined.roomId): void => {
    const room = world['rooms'].get(roomId);
    if (!room) return;
    const snapshot = world.snapshot(room.roomId)!;
    for (const role of room.players.values()) {
      const shown = snapshot.players.find(player => player.id === role.id)!;
      assert.equal(role.attributes.record.hp, role.hp);
      assert.equal(role.combat.record!.numericFields!.get(0x54), role.hp);
      assert.equal(role.attributes.record.maxHp, shown.maxHp);
      assert.equal(role.combat.record!.numericFields!.get(0x58), shown.maxHp);
      assert.equal(shown.hp, Math.round(role.hp));
      checkedHealthStates++;
    }
  };
  const player = () => {verifyHealth(); return world.snapshot(joined.roomId)!.players.find(p => p.id === ownerId)!;};

  const fullHealth = key();
  assert(!fullHealth.some(e => e.type === 'itemUsed'), 'Full health rejects use without consumption');
  assert(fullHealth.some(e => e.type === 'itemRejected' && e.message === '满血无需使用道具'));
  assert.equal(commits.length, 0);
  let evidence;
  for (let tick = 0; tick < 5000 && !evidence; tick++) {
    now += 50;
    const step = world.step(50);
    const before = player();
    if (!before.alive || before.hp === before.maxHp || (largeFeed && before.maxHp - before.hp < 400)) continue;
    assert(step.events.some(e => e.type === 'hit' && e.targetId === ownerId), 'Injury comes from normal CPU combat');
    allow = false;
    const rejected = key();
    assert(rejected.some(e => e.type === 'itemRejected'));
    assert.equal(player().hp, before.hp);
    assert.equal(world.inventory(ownerId).records[0].ownedQuantity, 4);
    storageThrows = true;
    assert(key().some(e => e.type === 'itemRejected'));
    assert.equal(player().hp, before.hp);
    assert.equal(world.inventory(ownerId).records[0].ownedQuantity, 4);
    assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 4);
    storageThrows = false;
    allow = true;
    const accepted = key();
    const used = accepted.find(e => e.type === 'itemUsed')!;
    assert(used);
    assert.equal(used.value, Math.min(healingAmount, before.maxHp - before.hp));
    assert.equal(player().hp, before.hp + used.value);
    assert.deepEqual(used.playSkillEffect, {skillId: definitionId, effectIndex: 0, duration: 0,
      roleId: Number(ownerId.slice(1)), xBits: 0, zBits: 0});
    assert.equal(world.inventory(ownerId).records[0].ownedQuantity, 3);
    assert.equal(world.inventory(ownerId).records[0].battleQuantity, 3);
    assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3);
    assert.deepEqual(key(sequence), [], 'Repeated input sequence cannot consume twice');
    evidence = {before, accepted, after: player(), inventory: world.inventory(ownerId)};
  }
  assert(evidence, 'Natural CPU combat must injure the human observer');
  if (largeFeed) assert.equal(evidence.accepted.find(event => event.type === 'itemUsed')!.value, 400);
  const finishNaturally = (): void => {
    for (let tick = 0; tick < 6200 && world.snapshot(joined.roomId)!.phase === 'PLAYING'; tick++) {
      now += 50;
      const step = world.step(50);
      deaths += step.events.filter(event => event.type === 'destroy').length;
      respawns += step.events.filter(event => event.type === 'respawn').length;
      verifyHealth();
    }
    assert.equal(world.snapshot(joined.roomId)!.phase, 'FINISHED');
  };
  finishNaturally();
  const firstResult = structuredClone(world.snapshot(joined.roomId)!.match!.result);
  now += 1000; world.step(1000);
  assert.deepEqual(world.snapshot(joined.roomId)!.match!.result, firstResult);
  assert.deepEqual(key(), [], 'Settlement rejects input and cannot consume');
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3);
  world.rematch(ownerId, 1);
  assert.equal(world.snapshot(joined.roomId)!.match!.round, 2);
  assert.equal(player().hp, player().maxHp);
  assert.equal(world.inventory(ownerId).records[0].ownedQuantity, 3);
  assert.equal(world.inventory(ownerId).records[0].battleQuantity, 3, 'Rematch initializes from remaining owned stock');
  assert.deepEqual(key(1), [], 'Old-round sequence cannot spend remaining stock');
  let secondUse;
  for (let tick = 0; tick < 6200 && world.snapshot(joined.roomId)!.phase === 'PLAYING'; tick++) {
    now += 50; world.step(50);
    const before = player();
    if (!before.alive || before.hp === before.maxHp) continue;
    const used = key().find(event => event.type === 'itemUsed');
    if (!used) continue;
    assert.equal(used.value, Math.min(healingAmount, before.maxHp - before.hp));
    assert.equal(world.inventory(ownerId).records[0].ownedQuantity, 2);
    assert.equal(world.inventory(ownerId).records[0].battleQuantity, 2);
    assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 2);
    secondUse = used; break;
  }
  assert(secondUse, 'Round2 must permit normal healing after another natural injury');
  finishNaturally();
  const secondResult = structuredClone(world.snapshot(joined.roomId)!.match!.result);
  world.leave(ownerId);
  assert.equal(world.snapshot(joined.roomId), undefined, 'Last human leaving clears the CPU room');
  const rejoined = world.createAndJoin('healing-owner', 4, 7, 'HealBack', 'Owner', 1);
  ownerId = rejoined.playerId;
  world.bindInventory(ownerId, store.inventory(account.accountId));
  for (let index = 0; index < 3; index++) world.manageCpu(ownerId, 1, 'ADD', 1);
  world.ready(ownerId, 1);
  assert.equal(world.inventory(ownerId).records[0].ownedQuantity, 2);
  assert.equal(world.inventory(ownerId).records[0].battleQuantity, 2);
  verifyHealth(rejoined.roomId);
  assert(deaths > 0 && respawns > 0, 'Ordinary combat must exercise death and revival health publication');
  const lifecycle = {firstResult, secondResult, secondUse, reentryInventory: world.inventory(ownerId), checkedHealthStates, deaths, respawns};
  assert.equal(store.consumeItem(other.accountId, 77, 2, definitionId), false);
  assert.equal(store.consumeItem(account.accountId, 77, 4, definitionId), false, 'Stale owned count cannot commit');
  assert.equal(store.consumeItem(account.accountId, 77, 2, largeFeed ? 1 : 2), false, 'Same instance/count but a different definition cannot commit');
  store.close(); store = new AccountStore(join(directory, 'accounts.sqlite'));
  assert.deepEqual(store.open(account.token), account);
  assert.deepEqual(store.inventory(account.accountId).records[0], {...item, ownedQuantity: 2});
  assert.deepEqual(store.inventory(other.accountId).records, []);
  writeFileSync(`recovery/output/${largeFeed ? 'large-feed' : 'healing-item'}-world.json`, JSON.stringify({status: 'PASS',
    scope: `Rebuilt self-healing/consume rules with source item${definitionId}/skill${definitionId} HP${healingAmount} and effect11. Real ordinary CPU fire supplies injury; normal human Digit5 input heals/consumes. Full HP/storage refusal/stale sequence/account isolation, two natural rounds with frozen settlement, stock retained on rematch/reentry and storage restart verified. Original FuncType2 dispatch and server3c9e success rules unproven.`, definitionId, healingAmount, sourceCap, explicitInitialOwnedPetHp: largeFeed ? 1000 : undefined, evidence, lifecycle, commits}, null, 2));
  console.log('PASS: natural combat injury → ordinary healing input → authority/storage success → HP/count/effect event; full/failed/stale rejection, account isolation, two natural rounds/rematch/reentry and restart');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
