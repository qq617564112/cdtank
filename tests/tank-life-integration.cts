import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {recomputeBattleAttributes} from '../apps/server/src/battle/attributes';

const rows = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows;
const row = rows.find((value: {tankId: number; part: number}) => value.tankId === 1 && value.part === 0);
const fields = (values: Record<string, number>) => new Map(Object.entries(values).map(([key, value]) => [Number(key), value]));
const world = new World();
const host = world.createAndJoin('life-rule-scope', 4, 7, 'Life', 'Owner', 1);
const player = world['rooms'].get(host.roomId)!.players.get(host.playerId)!;
const base = {name: 'Explicit pre-match native fixture', fields: fields(row.base)};
const equipment = {name: 'Explicit pre-match native fixture', fields: fields(row.equipment)};
world.bindRoleSources(host.playerId, {base, equipment});
const expected = player.recoveredMaxHp;
assert.equal(player.lifeReady, true);
assert(expected && expected > 0);
for (const offset of [0x34, 0x3c]) base.fields.delete(offset);
for (const offset of [0x34, 0x3c, 0x40, 0x4c, 0x50]) equipment.fields.delete(offset);
world.bindRoleSources(host.playerId, {base, equipment});
assert.equal(player.attributesReady, false);
assert.equal(player.lifeReady, true);
assert.equal(player.recoveredMaxHp, expected);
assert.equal(player.magazineReady, true);
assert.equal(world.snapshot(host.roomId)!.players.find(value => value.id === player.id)!.maxHp, expected);
const hpBefore = player.hp;
recomputeBattleAttributes(player);
assert.equal(player.hp, hpBefore, 'Attribute recalculation must not heal');
for (const offset of [0x58, 0x5c, 0x60]) {
  const incomplete = {...equipment, fields: new Map(equipment.fields)};
  incomplete.fields.delete(offset);
  world.bindRoleSources(host.playerId, {base, equipment: incomplete});
  assert.equal(player.lifeReady, false, 'A partial owned skill source cannot become an invented zero');
  assert.equal(player.magazineReady, false);
  assert.equal(world.roleSkillSources(host.playerId), undefined);
}
world.bindRoleSources(host.playerId, {base, equipment});
assert.equal(player.lifeReady, true);
assert.equal(player.magazineReady, true);
base.fields.delete(0x2c);
world.bindRoleSources(host.playerId, {base, equipment});
assert.equal(player.lifeReady, false);
assert.equal(player.recoveredMaxHp, undefined);
assert.equal(player.magazineReady, true);
world.leave(host.playerId);

// Mode3 assigns real VIP identities; no injected VIP flag or active health.
const vipWorld = new World();
const vipHost = vipWorld.createAndJoin('life-vip-rule', 3, 7, 'LifeVIP', 'Owner', 1);
const ids = [vipHost.playerId];
for (let index = 1; index < 4; index++) {
  ids.push(vipWorld.joinRoom(vipHost.roomId, `life-peer-${index}`, `Peer${index}`, 1).playerId);
}
for (const id of ids) {
  vipWorld.bindRoleSources(id, {base: {name: 'Explicit native pet', fields: fields(row.base)},
    equipment: {name: 'Explicit native tank', fields: fields(row.equipment)}});
  vipWorld.ready(id, 1);
}
const room = vipWorld['rooms'].get(vipHost.roomId)!;
for (const value of room.players.values()) {
  assert.equal(value.lifeReady, !value.vip, 'Unknown VIP multiplier must reject only original life qualification');
  assert.equal(value.magazineReady, true);
  assert(value.recoveredMovement);
}
for (const id of ids) vipWorld.leave(id);
writeFileSync('recovery/output/tank-life-integration.json', JSON.stringify({
  status: 'PASS_RULE_SCOPE_ONLY', maxHp: expected,
  scope: 'Explicit pre-match source fixtures and official qualification; not normal acquisition or damaged-player network proof.',
  checks: ['life independent of Crit/Lucky/armor/+34', 'snapshot maximum', 'no current HP write on recalculation',
    'partial owned skill sources refuse life/ammo', 'withdrawal', 'unknown VIP multiplier rejects life only', 'ammo/movement stay qualified']
}, null, 2) + '\n');
console.log('PASS independent life qualification, withdrawal, no-heal recalculation and VIP separation');
