import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {writeRoleProfileEquipment} from '../apps/server/src/accounts/profile/equipment';
const evidence: {rows: {base: Record<string, number>; equipment: Record<string, number>;
  tankId: number; petId: number; part: number; values: {recordFields: Record<string, number>;
  roleIntegers: Record<string, number>; roleFloats: Record<string, number>}}[]} =
  JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8'));
const map = (fields: Record<string, number>) => new Map(Object.entries(fields).map(([key, value]) => [Number(key), value]));
let firingCases = 0;
for (const row of evidence.rows) {
  let now = 100000;
  const world = new World(() => now, {timeLimitSeconds: 12});
  const host = world.createAndJoin('attribute-host', 4, 7, '属性验证', 'Host', row.tankId);
  assert.equal(world.roleAttributes(host.playerId).ready, false);
  world.bindRoleSources(host.playerId, {base: {name: 'Imported pet', fields: map(row.base)},
    equipment: {name: 'Imported tank', fields: map(row.equipment)}});
  const profile = {bytes: new Uint8Array(0x170), strings: ['', ''] as [string, string]};
  world.bindInventory(host.playerId, {hotkeys: Array(7).fill(0), records: row.part ? [{instanceId: 0xf1234567,
    itemTableId: row.part, ownedQuantity: 1, battleQuantity: 0, state: 2, field8: 0,
    float24Bits: 0, float28Bits: 0, float2cBits: 0}] : []});
  writeRoleProfileEquipment(profile, [row.part ? 0xf1234567 : 0, 0, 0, 0, 0]);
  world.bindEquipmentProfile(host.playerId, profile);
  const actual = world.roleAttributes(host.playerId);
  assert.equal(actual.ready, true);
  assert.equal(actual.maxBullet, row.values.recordFields['56'] >>> 0);
  assert.deepEqual(actual.recordFields, row.values.recordFields);
  assert.deepEqual(actual.roleIntegers, row.values.roleIntegers);
  assert.deepEqual(actual.roleFloats, row.values.roleFloats);
  assert.equal(actual.normalReloadSeconds, row.values.roleFloats['80']);
  if (row.part === 0) {
    world.ready(host.playerId, 1);
    assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
    const player = world.snapshot(host.roomId)!.players.find(p => p.id === host.playerId)!;
    assert.equal(player.maxHp, row.values.recordFields['88']);
    assert.equal(player.hp, player.maxHp);
    world.updateInput(host.playerId, {sequence: 1, move: 0, turn: 0, aim: 0, fire: true, useItem: 0, clientTime: now});
    const fireTimes: number[] = [];
    for (let tick = 0; tick < 220; tick++) {
      now += 50;
      if (world.step(50).events.some(event => event.type === 'fire' && event.playerId === host.playerId)) fireTimes.push(now);
    }
    assert(fireTimes.length >= 2);
    for (let index = 1; index < fireTimes.length; index++) {
      const elapsed = (fireTimes[index] - fireTimes[index - 1]) / 1000;
      assert(elapsed + .000001 >= actual.normalReloadSeconds!);
      assert(elapsed <= actual.normalReloadSeconds! + .051);
    }
    now += 1100; world.step(1100);
    assert.equal(world.snapshot(host.roomId)!.phase, 'FINISHED');
    world.rematch(host.playerId, 1);
    assert.equal(world.snapshot(host.roomId)!.phase, 'PLAYING');
    const second = world.snapshot(host.roomId)!.players.find(p => p.id === host.playerId)!;
    assert.equal(second.hp, player.maxHp);
    assert.equal(second.maxHp, player.maxHp);
    firingCases++;
  }
  world.leave(host.playerId);
}
// Invalid/missing sources must not publish a usable calculation from a previous loadout.
const world = new World();
const host = world.createAndJoin('missing', 4, 7, '来源缺失', 'Missing', 1);
const row = evidence.rows[0];
world.bindRoleSources(host.playerId, {base: {name: '', fields: map(row.base)}, equipment: {name: '', fields: map(row.equipment)}});
assert(world.roleAttributes(host.playerId).ready);
world.bindRoleSources(host.playerId, {base: undefined, equipment: undefined});
assert.equal(world.roleAttributes(host.playerId).ready, false);
world.bindRoleSources(host.playerId, {base: {name: '', fields: new Map([[0, 73], [8, row.petId]])},
  equipment: {name: '', fields: map(row.equipment)}});
assert.equal(world.roleAttributes(host.playerId).ready, false);
// Owned CPU loadout is an explicit import fixture, never a default grant.
let cpuNow = 100000;
const cpuWorld = new World(() => cpuNow);
const observer = cpuWorld.createAndJoin('observer', 4, 7, '拥有来源', 'Observer', 1);
const cpuIds: string[] = [];
for (let index = 0; index < 3; index++) {
  const cpuId = cpuWorld.manageCpu(observer.playerId, 1, 'ADD', evidence.rows[index * 6].tankId);
  const source = evidence.rows[index * 6];
  cpuWorld.bindRoleSources(cpuId, {base: {name: 'Explicit CPU pet', fields: map(source.base)},
    equipment: {name: 'Explicit CPU tank', fields: map(source.equipment)}});
  assert(cpuWorld.roleAttributes(cpuId).ready);
  cpuIds.push(cpuId);
}
for (const cpuId of cpuIds) cpuWorld.ready(cpuId, 1);
cpuWorld.ready(observer.playerId, 1);
let cpuFire = 0, cpuHit = 0;
for (let tick = 0; tick < 6200 && cpuWorld.snapshot(observer.roomId)!.phase === 'PLAYING'; tick++) {
  cpuNow += 50;
  for (const event of cpuWorld.step(50).events) {
    if (!cpuIds.includes(event.playerId)) continue;
    if (event.type === 'fire') cpuFire++;
    if (event.type === 'hit') cpuHit++;
  }
}
assert.equal(cpuWorld.snapshot(observer.roomId)!.phase, 'FINISHED');
assert(cpuFire > 0 && cpuHit > 0, 'CPU ordinary inputs exercise recovered owned life/reload in actual combat');
for (const cpuId of cpuIds) assert(cpuWorld.roleAttributes(cpuId).ready);
writeFileSync('recovery/output/world-role-attributes.json', JSON.stringify({status: 'PASS',
  nativeRows: evidence.rows.length, realNormalFireTankCases: firingCases,
  completeValuesMatch: true, actualStartHpAndMaxHp: true, ordinaryInputReload: true,
  invalidSourcesDisableReady: true, rematchLifeReset: true, ownedCpu: {fire: cpuFire, hit: cpuHit, naturalFinish: true},
  scope: 'Full World recompute for explicit imported non-VIP initial-state sources. Original full433466 values match; normal default-ammo deadlines and start HP applied. Damage, movement, VIP and special-ammo remain reconstructed/unverified.'}, null, 2) + '\n');
console.log(`PASS: ${evidence.rows.length} native full attributes via World; ${firingCases} tanks ordinary default-ammo firing and start life`);
