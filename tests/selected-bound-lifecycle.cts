import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';

const fixture = JSON.parse(readFileSync('recovery/output/pet2-binding-candidate-owned-fields.json', 'utf8'));
const native = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8'));
const row = native.rows[0];
const equipment = {name: 'Explicit native tank fixture', fields: new Map<number, number>(
  Object.entries(row.equipment).map(([key, value]) => [Number(key), Number(value)]))};
const base = {name: fixture.record.name, fields: new Map<number, number>(fixture.record.fields)};
const world = new World();
const joined = world.createAndJoin('selected-source-life', 4, 7, '来源生命周期', 'Host', row.tankId);
world.bindRoleSources(joined.playerId, {base, equipment});
const first = world.snapshot(joined.roomId)!.players[0].roleSkillSources!;
assert(first.selectedSkillIds.includes(10251));
const slots = [...first.currentSkillIds];
base.fields.set(0x6c, 2);
assert.equal(world.roleSkillSources(joined.playerId)!.equipmentSkills![4].rank, 1);
world.bindRoleSources(joined.playerId, {base, equipment});
assert.equal(world.roleSkillSources(joined.playerId)!.equipmentSkills![4].rank, 2);
assert.deepEqual(world.roleSkillSources(joined.playerId)!.currentSkillIds, slots);
world.bindRoleSources(joined.playerId, {base: undefined, equipment});
assert.equal(world.roleSkillSources(joined.playerId)!.equipmentSkills, undefined);
assert.deepEqual(world.roleSkillSources(joined.playerId)!.currentSkillIds, slots);
world.bindRoleSources(joined.playerId, {base: {name: fixture.record.name,
  fields: new Map(fixture.record.fields)}, equipment});
world.ready(joined.playerId, 1);
assert.equal(world.snapshot(joined.roomId)!.phase, 'PLAYING');
assert.throws(() => world.bindRoleSources(joined.playerId, {base: undefined, equipment}));
assert.equal(world.roleSkillSources(joined.playerId)!.equipmentSkills![4].rank, 1);
world.leave(joined.playerId);
assert.throws(() => world.roleSkillSources(joined.playerId));
const next = world.createAndJoin('selected-source-life', 4, 7, '新生命周期', 'Host', row.tankId);
assert.equal(world.snapshot(next.roomId)!.players[0].roleSkillSources, undefined);
world.leave(next.playerId);
writeFileSync('recovery/output/selected-bound-lifecycle.json', JSON.stringify({
  status: 'PASS_SELECTED_BOUND_PREPARATION_REPLACEMENT_LIVE_FREEZE_LEAVE',
  fixture: fixture.checkpoint, selectedSkillIds: first.selectedSkillIds,
  currentSkillIds: slots, scope: 'Explicit native record fixture for lifetime checks; no acquisition claim.',
}, null, 2) + '\n');
console.log('PASS: selected source replacement, live freeze and new-player lifetime');
