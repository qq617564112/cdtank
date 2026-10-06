import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {freezeSelectedBoundSource} from '../recovery/prepared/selected-bound-source';
import {readRoleSkillSources} from '../apps/server/src/battle/roles/skill-sources';
import {selectRoleSkills} from '../apps/server/src/battle/roles/skills';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {OwnedRoleBaseRecord} from '../apps/shared/contracts/owned-base';

const fixture = JSON.parse(readFileSync('recovery/output/pet2-binding-candidate-owned-fields.json', 'utf8')) as {
  checkpoint: string; record: {name: string; fields: [number, number][]};
};
const selected: OwnedRoleBaseRecord = {name: fixture.record.name, fields: new Map(fixture.record.fields)};
const bound = freezeSelectedBoundSource(selected)!;
assert.notEqual(bound, selected);
assert.notEqual(bound.fields, selected.fields);
assert.deepEqual([...bound.fields], fixture.record.fields);
const currentSkillIds = [2001, ...Array<number>(15).fill(0)];
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const skills = new Map(catalog.skills.map(skill => [skill.skillId, skill]));
const sources = readRoleSkillSources({currentSkillIds, boundGear: bound,
  equipment: {name: '', fields: new Map([[0x58, 0], [0x5c, 0], [0x60, 0]])},
  roleFields: new Map()});
const selectedIds = selectRoleSkills(sources, skills).map(skill => skill.skillId);
assert.deepEqual(selectedIds, [2001, 10251]);
assert.deepEqual(currentSkillIds, [2001, ...Array<number>(15).fill(0)]);
// Owned records can change independently; the running binding keeps its captured ranks.
(selected.fields as Map<number, number>).set(0x6c, 2);
assert.equal(bound.fields.get(0x6c), 1);
const replacement = freezeSelectedBoundSource(selected)!;
assert.equal(replacement.fields.get(0x6c), 2);
assert.equal(freezeSelectedBoundSource(undefined), undefined);
const partial = {name: selected.name, fields: new Map(selected.fields)};
partial.fields.delete(0x70);
assert.equal(freezeSelectedBoundSource(partial), undefined);
const zeroRank = {name: selected.name, fields: new Map(selected.fields)};
zeroRank.fields.set(0x70, 0);
assert.equal(freezeSelectedBoundSource(zeroRank)!.fields.get(0x70), 0);
writeFileSync('recovery/output/selected-bound-source-rules.json', JSON.stringify({
  status: 'PASS_PREPARED_SELECTED_BOUND_SOURCE_MODULE_ONLY',
  policy: 'Ownership validation belongs to caller; WAITING/start copies selected source. Original +a0 producer remains unknown.',
  fixture: fixture.checkpoint, selectedSkillIds: selectedIds,
  preservedCurrentSkillIds: currentSkillIds,
  cases: ['independent record/map copy', 'selected pet2 passive10251 only', 'source mutation isolation',
    'replacement captures new ranks', 'absent selection clears binding', 'missing rank does not default', 'explicit zero rank retained'],
  productionImported: false, networkExecuted: false,
}, null, 2) + '\n');
console.log('PASS: prepared selected binding, independent source lifetime and original pet2 passive selection');
