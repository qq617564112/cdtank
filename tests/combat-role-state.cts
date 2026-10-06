import type {RoleSkillRecord} from '../apps/shared/contracts/role-skills';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {selectRoleSkills} from '../apps/server/src/battle/roles/skills';
import {readRoleDataScaleLimits} from '../apps/server/src/battle/roles/data-scale';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import {accumulateRoleReload, computeRoleReload} from '../recovery/evidence/roles/reload';
import {roleSkillMultiplier} from '../apps/server/src/battle/roles/reload';

interface StateSnapshot {
  present: boolean;
  dirty: boolean;
  flag8Seconds: number;
  specialFlag12: number;
  nextAvailableSeconds: number;
  activeActionId: number;
  record: {status: 0 | 1 | 2 | 3; flags: number[]; arrays: Record<string, number[]>} | null;
}
interface Notification {index: number; state: StateSnapshot;}
interface StateCase {
  initial: StateSnapshot;
  result: StateSnapshot;
  notifications: Notification[];
}
const evidence: {
  flags: Array<StateCase & {index: number; value: number; read: number}>;
  absentReads: Record<string, number>;
  arrays: Array<StateCase & {index: number; values: number[]; accepted: boolean; needsRecompute: boolean}>;
  lifecycle: Array<StateCase & {status: 0 | 1 | 2 | 3}>;
  skillChanges: Array<StateCase & {operation: 'ADD' | 'REMOVE' | 'REMOVE_AT'; value: number; returned: number | null}>;
  completion: StateCase;
} = JSON.parse(readFileSync('recovery/output/combat-role-state-native.json', 'utf8'));

function snapshot(state: RoleCombatState): StateSnapshot {
  return {present: !!state.record, dirty: state.dirty, flag8Seconds: state.flag8Seconds,
    specialFlag12: state.specialFlag12, nextAvailableSeconds: state.nextAvailableSeconds,
    activeActionId: state.activeActionId, record: state.record ? {
      status: state.record.status, flags: [...state.record.flags],
      arrays: Object.fromEntries([...state.record.arrays].map(([index, values]) => [String(index), [...values]])),
    } : null};
}

function fixture(initial: StateSnapshot): {state: RoleCombatState; notifications: Notification[]} {
  const notifications: Notification[] = [];
  const record = initial.record ? {status: initial.record.status,
    flags: Uint8Array.from(initial.record.flags),
    arrays: new Map(Object.entries(initial.record.arrays).map(([index, values]) => [Number(index), Int32Array.from(values)])),
  } : undefined;
  const state = new RoleCombatState(record, index => {notifications.push({index, state: snapshot(state)});});
  Object.assign(state, {dirty: initial.dirty, flag8Seconds: initial.flag8Seconds,
    specialFlag12: initial.specialFlag12, nextAvailableSeconds: initial.nextAvailableSeconds,
    activeActionId: initial.activeActionId});
  return {state, notifications};
}

for (const row of evidence.flags) {
  const {state, notifications} = fixture(row.initial);
  state.setFlag(row.index, row.value);
  assert.deepEqual(snapshot(state), row.result);
  assert.equal(state.getFlag(row.index), row.read);
  assert.deepEqual(notifications, row.notifications);
}
const absent = fixture(evidence.flags.find(row => !row.initial.present)!.initial).state;
for (const [index, value] of Object.entries(evidence.absentReads)) assert.equal(absent.getFlag(Number(index)), value);
for (const row of evidence.arrays) {
  const {state, notifications} = fixture(row.initial);
  assert.equal(state.setArray(row.index, row.values), row.accepted);
  assert.equal(state.needsRecompute(), row.needsRecompute);
  assert.deepEqual(snapshot(state), row.result);
  assert.deepEqual(notifications, row.notifications);
}
for (const row of evidence.lifecycle) {
  const {state, notifications} = fixture(row.initial);
  state.setStatus(row.status);
  assert.deepEqual(snapshot(state), row.result);
  assert.deepEqual(notifications, row.notifications);
}
const {state, notifications} = fixture(evidence.completion.initial);
state.finishRecompute();
assert.deepEqual(snapshot(state), evidence.completion.result);
assert.deepEqual(notifications, evidence.completion.notifications);
for (const row of evidence.skillChanges) {
  const {state, notifications} = fixture(row.initial);
  if (row.operation === 'ADD') assert.equal(state.addSkill(row.value), row.returned);
  else if (row.operation === 'REMOVE') state.removeSkill(row.value);
  else state.removeSkillAt(row.value);
  assert.deepEqual(snapshot(state), row.result);
  assert.deepEqual(notifications, row.notifications);
}
// Connect recovered mutation outputs to the actual source selector and reload
// accumulator using original source skill fields. This is a state pipeline
// fixture; it does not invent initial inventory or a skill-use network message.
interface ReloadSkill extends RoleSkillRecord {delay: number; loadTime: number; funcZ1: number;}
const sources: {catalog: RoleSkillRecord[]; items: Array<{itemId: number; skillIds: number[]}>} =
  JSON.parse(readFileSync('recovery/output/combat-role-skills-native.json', 'utf8'));
const reload: {skillReloadFields: Array<Omit<ReloadSkill, 'functions'>>} =
  JSON.parse(readFileSync('recovery/output/combat-client-evidence.json', 'utf8'));
const reloadById = new Map(reload.skillReloadFields.map(skill => [skill.skillId, skill]));
const catalog = new Map(sources.catalog.map(skill => [skill.skillId, {...skill, ...reloadById.get(skill.skillId)!}]));
const scaleCatalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const reloadLimits = readRoleDataScaleLimits(scaleCatalog.dataScales).get(16)!;
const skillsWithReload = sources.catalog.filter(skill => reloadById.get(skill.skillId)!.delay !== 0).slice(0, 20);
const pipeline = fixture(evidence.skillChanges.find(row => row.operation === 'ADD'
  && row.initial.record!.arrays['4'].every(id => id === 0))!.initial).state;
for (const skill of skillsWithReload) {
  pipeline.addSkill(skill.skillId);
  const ids = [...pipeline.record!.arrays.get(4)!];
  const selected = selectRoleSkills({currentSkillIds: ids, extraSkill: {baseId: 0, rank: 0}}, catalog);
  assert.deepEqual(selected.map(record => record.skillId), ids.filter(id => catalog.has(id)));
  let fields = {baseDuration: 0, type1Factor: 0};
  for (const record of selected) fields = accumulateRoleReload(fields, record.delay, record.loadTime,
    roleSkillMultiplier(record.triggerType, 10, record.funcZ1));
  const duration = computeRoleReload(fields.baseDuration, fields.type1Factor, reloadLimits);
  assert(duration.normalSeconds >= Math.fround(reloadLimits.lower * Math.fround(.1))
    && duration.normalSeconds <= Math.fround(reloadLimits.upper * Math.fround(.1)));
  assert(pipeline.needsRecompute());
  pipeline.finishRecompute();
  assert(!pipeline.needsRecompute());
}
console.log(`PASS: ${evidence.flags.length} flag updates, ${evidence.arrays.length} array updates, ${evidence.lifecycle.length} lifecycle transitions, ${evidence.skillChanges.length} skill changes and ordered recompute completion match original functions`);
