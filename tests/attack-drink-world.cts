import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {World} from '../apps/server/src/world';
import {AccountStore} from '../apps/server/src/account-store';
import {TANKS} from '../apps/server/src/config';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-drink-world-'));
let store = new AccountStore(join(directory, 'accounts.sqlite'));
try {
  const account = store.open();
  const item = {instanceId: 77, itemTableId: 4, ownedQuantity: 8, battleQuantity: 0,
    state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0};
  store.replaceInventory(account.accountId, [item]);
  store.assign(account.accountId, 77, 4);
  let now = 100000, allow = true, storageFails = false;
  const world = new World(() => now, {consumeItem: (_id, instance, owned, definition) => {
    if (storageFails) throw new Error('Explicit persistence failure');
    return allow && store.consumeItem(account.accountId, instance, owned, definition);
  }});
  const host = world.createAndJoin('drink', 4, 7, 'Drink', 'Owner', 1);
  const native = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows[0];
  const fields = (record: Record<string, number>) => new Map(Object.entries(record).map(([key, value]) => [Number(key), value]));
  world.bindRoleSources(host.playerId, {base: {name: 'Explicit native pet', fields: fields(native.base)},
    equipment: {name: 'Explicit native tank', fields: fields(native.equipment)}});
  world.bindInventory(host.playerId, store.inventory(account.accountId));
  world.ready(host.playerId, 1);
  const player = () => world.snapshot(host.roomId)!.players.find(value => value.id === host.playerId)!;
  let sequence = 0;
  const input = (useItem: number, fire = false) => world.updateInput(host.playerId,
    {sequence: ++sequence, move: 0, turn: 0, aim: 0, fire, useItem, clientTime: now});
  const base = world.roleAttributes(host.playerId);
  assert(base.ready);
  assert.equal(world.inventory(host.playerId).records[0].battleQuantity, 5);
  allow = false;
  assert(input(5).some(event => event.type === 'itemRejected'));
  storageFails = true;
  assert(input(5).some(event => event.type === 'itemRejected'));
  assert.equal(player().attackBoost, undefined);
  assert.deepEqual(world.roleAttributes(host.playerId), base);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 8);
  storageFails = false; allow = true;
  const used = input(5).find(event => event.type === 'itemUsed')!;
  assert.equal(used.playSkillEffect!.skillId, 4);
  assert.deepEqual(player().attackBoost, {skillId: 4, expiresAt: 110000, attackPercent: 100, attackBonus: 20});
  const boosted = world.roleAttributes(host.playerId);
  assert.equal(boosted.roleIntegers!['120'], base.roleIntegers!['120'] + 20);
  assert.equal(boosted.roleFloats!['116'], Math.fround((base.roleFloats!['116']! * 100 + 100) * Math.fround(.01)));
  assert(input(5).some(event => event.type === 'itemRejected'));
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 7);
  assert.equal(world.inventory(host.playerId).records[0].battleQuantity, 4);
  input(0, true);
  const fires: string[] = [];
  for (let tick = 0; tick < 6; tick++) {
    now += 50;
    fires.push(...world.step(50).events.filter(event => event.type === 'fire').map(event => event.playerId));
  }
  assert(fires.includes(host.playerId), 'Ordinary fire accepts the active, qualified attack source');
  assert.equal(boosted.recoveredArmor!.attackBase, base.recoveredArmor!.attackBase);
  assert.equal(boosted.recoveredArmor!.attackBonus, base.recoveredArmor!.attackBonus + 20);
  assert(Math.abs(boosted.recoveredArmor!.attackPercent - base.recoveredArmor!.attackPercent - 1) < 1e-6);
  input(0);
  now = 109999; world.step(50); assert(player().attackBoost);
  now = 110000; const expired = world.step(50);
  assert(expired.events.some(event => event.stopSkillEffect?.skillId === 4));
  assert.equal(player().attackBoost, undefined);
  assert.deepEqual(world.roleAttributes(host.playerId), base);
  input(0, true); now += 50;
  assert(world.step(50).events.some(event => event.type === 'fire' && event.playerId === host.playerId));
  world.leave(host.playerId);
  store.close(); store = new AccountStore(join(directory, 'accounts.sqlite'));
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 7);
  assert.equal(store.inventory(account.accountId).hotkeys[3], 77);

  // The same ordinary input is exercised during real CPU fights and natural rematches.
  const battle = new World(() => now);
  const observer = battle.createAndJoin('drink-combat', 4, 7, '饮料对战', 'Owner', 1);
  battle.bindInventory(observer.playerId, {hotkeys: [0, 0, 0, 77, 0, 0, 0], records: [{...item, ownedQuantity: 3}]});
  for (let index = 0; index < 3; index++) battle.manageCpu(observer.playerId, 1, 'ADD', 1);
  battle.ready(observer.playerId, 1);
  let serial = 0, casts = 0, autonomousCasts = 0, enhancedHits = 0, deaths = 0, revivals = 0;
  const snapshot = () => battle.snapshot(observer.roomId)!;
  const local = () => snapshot().players.find(value => value.id === observer.playerId)!;
  const unqualifiedAttack = TANKS.find(tank => tank.id === 1)!.attack;
  const cast = () => battle.updateInput(observer.playerId, {sequence: ++serial, move: 0, turn: 0, aim: 0,
    fire: false, useItem: 5, clientTime: now}, !!local().isAutopilot);
  for (let round = 1; round <= 2; round++) {
    if (round === 2) battle.rematch(observer.playerId, 1);
    assert.equal(local().attackBoost, undefined);
    battle.configureAutopilot(observer.playerId, round, false);
    if (cast().some(event => event.type === 'itemUsed')) casts++;
    battle.configureAutopilot(observer.playerId, round, true);
    for (let tick = 0; tick < 6200 && snapshot().phase === 'PLAYING'; tick++) {
      now += 50;
      const events = battle.step(50).events;
      autonomousCasts += events.filter(event => event.type === 'itemUsed'
        && event.playerId === observer.playerId && event.skillId === 4).length;
      enhancedHits += events.filter(event => event.type === 'hit' && event.playerId === observer.playerId
        && event.value === 35 + (unqualifiedAttack * 2 + 20) * .08).length;
      deaths += events.filter(event => event.type === 'destroy' && event.targetId === observer.playerId).length;
      revivals += events.filter(event => event.type === 'respawn' && event.playerId === observer.playerId).length;
      if (!local().alive) assert.equal(local().attackBoost, undefined);
    }
    assert.equal(snapshot().phase, 'FINISHED');
    assert(snapshot().players.every(value => !value.attackBoost));
  }
  assert(casts >= 1, 'Normal manual input must use a drink before the autonomous battle');
  assert(casts + autonomousCasts <= 3, 'Autonomous item use shares the same finite inventory');
  assert(enhancedHits > 0 && deaths > 0 && revivals > 0);
  assert.equal(battle.inventory(observer.playerId).records[0].ownedQuantity, 3 - casts - autonomousCasts);
  battle.leave(observer.playerId);
  writeFileSync('recovery/output/attack-drink-world.json', JSON.stringify({status: 'PASS',
    base, boosted, used, fires, casts, autonomousCasts, enhancedHits, deaths, revivals,
    scope: 'Ordinary inputs, explicit owned fixtures, qualified source attribute recompute and accepted fire/expiry; unqualified CPU prototype hits and natural two rounds/death/respawn/settlement/rematch; save refusal and store reopen. Qualified shot damage is covered by the separate fireProjectile consumer test.'}, null, 2));
  console.log('PASS: ordinary attack drink qualification/expiry, accepted fire, two natural CPU rounds and persistent consumption');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
