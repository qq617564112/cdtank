import type {RoleSkillRecord} from '../../../apps/shared/contracts/role-skills';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isPassiveRoleSkill, selectRoleSkills, type RoleItemSkills, type RoleSkillSources} from '../../../apps/server/src/battle/roles/skills';

const evidence: {
  catalog: RoleSkillRecord[];
  items: RoleItemSkills[];
  predicates: Array<{skill: RoleSkillRecord | null; passive: boolean}>;
  traversals: Array<{sources: RoleSkillSources; selected: number[]}>;
} = JSON.parse(readFileSync('recovery/output/combat-role-skills-native.json', 'utf8'));
const catalog = new Map(evidence.catalog.map(skill => [skill.skillId, skill]));
const items = new Map(evidence.items.map(item => [item.itemId, item]));
for (const row of evidence.predicates) {
  assert.equal(isPassiveRoleSkill(row.skill ?? undefined), row.passive);
}
for (const row of evidence.traversals) {
  assert.deepEqual(selectRoleSkills(row.sources, catalog, items).map(skill => skill.skillId), row.selected);
}
assert(evidence.traversals.some(row => row.selected.length === 3),
  'The original source order must allow repeated passive equipment/extra skills');
assert(evidence.traversals.some(row => row.selected.length === 2
  && row.selected[0] === row.selected[1]), 'Current-slot duplicates must retain both additions');
const currentItemSkill = evidence.traversals.at(-1)!;
assert.equal(currentItemSkill.selected.filter(id => id === currentItemSkill.sources.currentSkillIds![0]).length, 1,
  'Item expansion must exclude skills already in array getter4');
console.log(`PASS: ${evidence.predicates.length} passive predicates and ${evidence.traversals.length} skill selections match original traversal`);
