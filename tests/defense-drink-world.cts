import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {World} from '../apps/server/src/world';
import {AccountStore} from '../apps/server/src/account-store';
import type {PlayerState} from '../apps/server/src/battle/player-state';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-defense-world-'));
const database = join(directory, 'accounts.sqlite');
let store = new AccountStore(database), now = 100000;
const native = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows
  .find((row: {tankId: number; part: number}) => row.tankId === 1 && row.part === 0);
const fields = (source: Record<string, number>) => new Map(Object.entries(source).map(([key, value]) => [Number(key), value]));
const owned = {base: {name: 'Explicit imported pet', fields: fields(native.base)},
  equipment: {name: 'Explicit imported tank', fields: fields(native.equipment)}};
// Observe actual accepted inputs, attributes and projectile collisions without writing battle state.
function players(world: World, roomId: string): Map<string, PlayerState> {
  return (world as unknown as {rooms: Map<string, {players: Map<string, PlayerState>}>}).rooms.get(roomId)!.players;
}
const item = {instanceId: 77, itemTableId: 5, ownedQuantity: 3, battleQuantity: 0,
  state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0};
try {
  const account = store.open(); store.replaceInventory(account.accountId, [item]); store.assign(account.accountId, 77, 4);
  let allow = true, failure = false, persistedConsumes = 0;
  const consume = (_id: string, instance: number, quantity: number, definition: number): boolean => {
    if (failure) throw new Error('Explicit persistence failure');
    const accepted = allow && store.consumeItem(account.accountId, instance, quantity, definition);
    if (accepted) persistedConsumes++;
    return accepted;
  };
  const solo = new World(() => now, {consumeItem: consume});
  const joined = solo.createAndJoin('defense-source', 4, 7, '防御来源', 'Owner', 1);
  solo.bindRoleSources(joined.playerId, owned); solo.bindInventory(joined.playerId, store.inventory(account.accountId));
  solo.ready(joined.playerId, 1);
  const local = players(solo, joined.roomId).get(joined.playerId)!;
  const baseline = solo.roleAttributes(joined.playerId); assert(baseline.ready);
  let sequence = 0;
  const send = (useItem = 5) => solo.updateInput(joined.playerId,
    {sequence: ++sequence, move: 0, turn: 0, aim: 0, fire: false, useItem, clientTime: now});
  allow = false; assert(send().some(event => event.type === 'itemRejected'));
  allow = true; failure = true; assert(send().some(event => event.type === 'itemRejected'));
  assert.equal(local.defenseBoost, undefined); assert.deepEqual(solo.roleAttributes(joined.playerId), baseline);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3); failure = false;
  const used = send().find(event => event.type === 'itemUsed')!; assert(used);
  assert.equal(used.skillId, 5); assert.equal(used.playSkillEffect?.skillId, 5);
  const boosted = solo.roleAttributes(joined.playerId), active = {...local.defenseBoost!};
  assert.equal(boosted.roleIntegers!['136'], baseline.roleIntegers!['136'] + 20);
  assert.equal(boosted.roleFloats!['124'], Math.fround((baseline.roleFloats!['124'] * 100 + 30) * Math.fround(.01)));
  assert.equal(active.baseDefense, baseline.roleIntegers!['136'] + baseline.roleFloats!['124']);
  assert.equal(active.boostedDefense, boosted.roleIntegers!['136'] + boosted.roleFloats!['124']);
  assert.equal(active.source, 'original-attributes'); assert.equal(active.expiresAt, now + 10000);
  assert(send().some(event => event.type === 'itemRejected'));
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 2);
  assert.equal(solo.inventory(joined.playerId).records[0].battleQuantity, 2);
  now = active.expiresAt - 1; solo.step(50); assert(local.defenseBoost);
  now = active.expiresAt; assert(solo.step(50).events.some(event => event.stopSkillEffect?.skillId === 5));
  assert.equal(local.defenseBoost, undefined); assert.deepEqual(solo.roleAttributes(joined.playerId), baseline);
  solo.leave(joined.playerId);

  // Missing stock and a full skill table are actual shortcut inputs with initial owned fixtures.
  const refused = new World(() => now);
  const empty = refused.createAndJoin('defense-empty', 4, 7, 'Empty', 'Owner', 1);
  refused.bindInventory(empty.playerId, {hotkeys: [0, 0, 0, 77, 0, 0, 0], records: [{...item, ownedQuantity: 0}]});
  refused.ready(empty.playerId, 1);
  assert(!refused.updateInput(empty.playerId, {sequence: 1, move: 0, turn: 0, aim: 0, fire: false,
    useItem: 5, clientTime: now}).some(event => event.type === 'itemUsed'));
  assert.equal(players(refused, empty.roomId).get(empty.playerId)!.defenseBoost, undefined);
  refused.leave(empty.playerId);
  const full = refused.createAndJoin('defense-full', 4, 7, '技能满槽', 'Owner', 1);
  refused.bindInventory(full.playerId, {hotkeys: [0, 0, 0, 77, 0, 0, 0], records: [{...item, ownedQuantity: 1}]});
  refused.ready(full.playerId, 1);
  const fullPlayer = players(refused, full.roomId).get(full.playerId)!;
  // Explicit initial occupied skill-table fixture; no health, movement or damage writes.
  for (let id = 100; id < 116; id++) fullPlayer.combat.addSkill(id);
  const fullSkills = [...fullPlayer.combat.record!.arrays.get(4)!];
  assert(refused.updateInput(full.playerId, {sequence: 1, move: 0, turn: 0, aim: 0, fire: false,
    useItem: 5, clientTime: now}).some(event => event.type === 'itemRejected'));
  assert.equal(fullPlayer.defenseBoost, undefined);
  assert.deepEqual([...fullPlayer.combat.record!.arrays.get(4)!], fullSkills);
  assert.equal(refused.inventory(full.playerId).records[0].ownedQuantity, 1);
  refused.leave(full.playerId);

  const battle: World = new World(() => now, {consumeItem: (id, instance, quantity, definition) =>
    id === owner.playerId ? consume(id, instance, quantity, definition) : true});
  const owner = battle.createAndJoin('defense-ai', 4, 7, '防御对战', 'Owner', 1);
  battle.bindRoleSources(owner.playerId, owned); battle.bindInventory(owner.playerId, store.inventory(account.accountId));
  const cpuIds = Array.from({length: 3}, () => battle.manageCpu(owner.playerId, 1, 'ADD', 1));
  // CPU ownership is explicit; it is never issued by the production room or rematch path.
  for (const [index, id] of cpuIds.entries()) {
    battle.bindInventory(id, {hotkeys: [0, 0, 0, 100 + index, 0, 0, 0], records: [{...item,
      instanceId: 100 + index, ownedQuantity: 1}]});
  }
  // Only the account owner uses durable stock; CPU records are isolated initial fixtures.
  const roomPlayers = players(battle, owner.roomId), ownerState = roomPlayers.get(owner.playerId)!;
  battle.configureAutopilot(owner.playerId, 1, true); battle.ready(owner.playerId, 1);
  const rounds: object[] = [], casts: object[] = [], hitEvidence: object[] = [];
  let autonomousUses = 0, cpuUses = 0, reducedHits = 0, ordinaryHits = 0, deaths = 0, revivals = 0, stops = 0;
  for (let round = 1; round <= 2; round++) {
    if (round === 2) battle.rematch(owner.playerId, 1);
    assert([...roomPlayers.values()].every(player => !player.defenseBoost));
    const stockAtStart = battle.inventory(owner.playerId).records[0].ownedQuantity;
    assert.equal(battle.inventory(owner.playerId).records[0].battleQuantity, stockAtStart);
    let roundReduced = 0;
    for (let tick = 0; tick < 6200 && battle.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
      const before = new Map([...roomPlayers].map(([id, player]) => [id, {hp: player.hp, x: player.x, z: player.z,
        alive: player.alive, boost: player.defenseBoost && {...player.defenseBoost},
        armor: player.armorReady && player.recoveredArmor ? {...player.recoveredArmor} : undefined}]));
      now += 50; const events = battle.step(50).events;
      for (const event of events) {
        if (event.type === 'itemUsed' && event.skillId === 5) {
          const caster = roomPlayers.get(event.playerId)!, prior = before.get(caster.id)!;
          assert.equal(caster.input.useItem, 5); assert(caster.defenseBoost);
          assert(prior.hp <= battle.roleAttributes(caster.id).maxHp * .75);
          assert([...roomPlayers.values()].some(enemy => enemy.id !== caster.id && before.get(enemy.id)!.alive
            && Math.hypot(before.get(enemy.id)!.x - prior.x, before.get(enemy.id)!.z - prior.z) <= 500));
          if (caster.id === owner.playerId) autonomousUses++; else cpuUses++;
          prior.armor = caster.armorReady && caster.recoveredArmor ? {...caster.recoveredArmor} : undefined;
          prior.boost = {...caster.defenseBoost};
          casts.push({round, playerId: caster.id, hp: prior.hp, boost: caster.defenseBoost});
        }
        if (event.type === 'hit') {
          const attacker = roomPlayers.get(event.playerId)!, target = roomPlayers.get(event.targetId!)!;
          const attack = attacker.attackBoost
            ? attacker.tank.attack * (1 + attacker.attackBoost.attackPercent / 100) + attacker.attackBoost.attackBonus
            : attacker.tank.attack;
          const a = attacker.armorReady ? attacker.recoveredArmor : undefined;
          const raw = a ? Math.round(Math.max(0, a.attackBase * a.attackPercent + a.attackBonus))
            : 35 + attack * .08;
          const boost = before.get(target.id)!.boost;
          const prior = before.get(target.id)!;
          const armor = prior.boost && now >= prior.boost.expiresAt
            ? (target.armorReady ? target.recoveredArmor : undefined) : prior.armor;
          const expected = armor
            ? raw * 100 / (100 + Math.max(0, armor.defensePercent * 100 + armor.defenseBonus))
            : boost && now < boost.expiresAt
              ? raw * Math.max(0, Math.min(1, (100 + boost.baseDefense) / (100 + boost.boostedDefense))) : raw;
          assert(Math.abs(event.value - expected) < 1e-9, JSON.stringify({
            observed: event.value, expected, raw, attackerId: attacker.id, targetId: target.id,
            armor, boost, currentArmor: target.recoveredArmor, events,
          }));
          prior.hp = Math.max(0, (prior.hp - event.value) | 0);
          if (expected < raw) {reducedHits++; roundReduced++;
            if (hitEvidence.length < 12) hitEvidence.push({round, attackerId: attacker.id, targetId: target.id, raw, observed: event.value, boost});
          } else ordinaryHits++;
        }
        if (event.type === 'destroy') {deaths++; assert.equal(roomPlayers.get(event.targetId!)!.defenseBoost, undefined);}
        if (event.type === 'respawn') revivals++;
        if (event.stopSkillEffect?.skillId === 5) stops++;
      }
      for (const player of roomPlayers.values()) if (!player.alive) assert.equal(player.defenseBoost, undefined);
    }
    const snapshot = battle.snapshot(owner.roomId)!;
    assert.equal(snapshot.phase, 'FINISHED'); assert(snapshot.players.every(player => !player.defenseBoost));
    assert.equal(battle.inventory(owner.playerId).records[0].ownedQuantity, 2 - autonomousUses);
    rounds.push({round, stockAtStart, stockAtFinish: 2 - autonomousUses, reducedHits: roundReduced, result: snapshot.match!.result});
  }
  assert.equal(autonomousUses, 2); assert.equal(cpuUses, 3);
  assert(reducedHits > 0 && ordinaryHits > 0 && deaths > 0 && revivals > 0, JSON.stringify({reducedHits, ordinaryHits, deaths, revivals, stops}));
  assert.equal(persistedConsumes, 3);
  assert(cpuIds.every(id => battle.inventory(id).records[0].ownedQuantity === 0), 'CPU rematch does not replenish drinks');
  battle.leave(owner.playerId); store.close(); store = new AccountStore(database);
  const persisted = store.inventory(account.accountId);
  assert.equal(persisted.records[0].ownedQuantity, 0); assert.equal(persisted.hotkeys[3], 77);
  assert.equal(persisted.records[0].float24Bits, item.float24Bits);
  const reentry = new World(() => now);
  const rejoined = reentry.createAndJoin('defense-ai', 4, 7, '耗尽重入', 'Owner', 1);
  reentry.bindInventory(rejoined.playerId, persisted); reentry.ready(rejoined.playerId, 1);
  assert.equal(reentry.inventory(rejoined.playerId).records[0].battleQuantity, 0);
  assert(!reentry.updateInput(rejoined.playerId, {sequence: 1, move: 0, turn: 0, aim: 0, fire: false,
    useItem: 5, clientTime: now}).some(event => event.type === 'itemUsed'));
  reentry.leave(rejoined.playerId);
  writeFileSync('recovery/output/defense-drink-world.json', JSON.stringify({status: 'PASS', baseline, boosted, active, used,
    rounds, casts, hitEvidence, autonomousUses, cpuUses, reducedHits, ordinaryHits, deaths, revivals, stops, persisted,
    scope: 'Original skill5 attribute recompute; rebuilt qualified shot armor and legacy fallback. Persistent account stock3, ordinary manual and autonomous inputs, explicit CPU stock, natural projectile damage, two natural rounds/death/revive/finish/rematch, CAS/storage refusal, expiry, exhausted reentry and store reopen. No injected HP, position, damage or outcome.'}, null, 2));
  console.log('PASS: defense5 source recompute, finite manual/AI/CPU consumption, real reduced hits and two natural rounds');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
