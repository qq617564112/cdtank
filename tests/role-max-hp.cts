import type {RoleSkillRecord} from '../apps/shared/contracts/role-skills';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accumulateRoleMaxHp, finishRoleMaxHp} from '../recovery/evidence/roles/role-max-hp';
import {createRoleCombatState, RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {observeRoleSkillSlots} from '../recovery/evidence/roles/role-skill-observer';
import {encodeRoleArrayProperty, receiveRoleArrayProperties} from '../recovery/evidence/combat/role-array-property';
import {selectRoleSkills} from '../apps/server/src/battle/roles/skills';

interface Health {hp: number; maxHp: number}
const evidence: {
  additions: {skillId: number; triggerType: number; funcZ1: number; roleValue9: number;
    maxHp: number; base: number; result: Health}[];
  limits: {upper: number; lower: number};
  tails: {maxHp: number; vip: number; multiplier: number; result: Health;
    events: {index: number; health: Health; dirty: boolean}[]}[];
} = JSON.parse(readFileSync('recovery/output/role-max-hp-native.json', 'utf8'));
for (const row of evidence.additions) {
  assert.equal(accumulateRoleMaxHp(row.base, row, row.roleValue9), row.result.maxHp);
  assert.equal(row.result.hp, 37);
}
for (const row of evidence.tails) {
  const events: typeof row.events = [];
  const health = {hp: 777, maxHp: finishRoleMaxHp(row.maxHp, evidence.limits, row.vip, row.multiplier)};
  const state = new RoleCombatState(createRoleCombatState().record, index => {
    events.push({index, health: {...health}, dirty: state.dirty});
  });
  state.finishRecompute();
  assert.deepEqual(health, row.result);
  assert.deepEqual(events, row.events);
  assert.equal(state.dirty, false);
}
console.log(`PASS: ${evidence.additions.length} source skill MaxHP additions and ${evidence.tails.length} cap/VIP tails match original x86`);

const arrays: {arraySkillCatalog: RoleSkillRecord[]; arrayWireRows: {
  index: number; sourceSkillIds?: boolean; bytes: number[]; values: number[];
}[]} = JSON.parse(readFileSync('recovery/output/role-properties-native.json', 'utf8'));
const maximumHp = new Map(evidence.additions.map(row => [row.skillId, row]));
const catalog = new Map(arrays.arraySkillCatalog.map(skill => [skill.skillId,
  {...skill, maxHp: maximumHp.get(skill.skillId)!.maxHp, funcZ1: maximumHp.get(skill.skillId)!.funcZ1}]));
let cases = 0;
for (const row of arrays.arrayWireRows.filter(row => row.sourceSkillIds)) {
  const state = createRoleCombatState();
  state.dirty = false;
  const slots = state.record!.arrays.get(4)!;
  const previous = slots.slice();
  const bytes = new Uint8Array(slots.buffer, slots.byteOffset, slots.byteLength);
  const field = {width: 4 as const, count: 16, bytes, snapshot: bytes.slice()};
  const health = {hp: 777, maxHp: 200};
  const recomputed: number[] = [];
  const apply = (): void => {
    assert.equal(state.needsRecompute(), true);
    const selected = selectRoleSkills({currentSkillIds: [...slots], extraSkill: {baseId: 0, rank: 0}}, catalog);
    const accumulated = selected.reduce((sum, skill) => accumulateRoleMaxHp(sum, skill, 50), 200);
    health.maxHp = finishRoleMaxHp(accumulated, evidence.limits, 0, 1);
    recomputed.push(health.maxHp);
    state.finishRecompute();
  };
  const receive = (segment: Uint8Array): void => {
    assert.equal(receiveRoleArrayProperties(new Map([[31, field]]), [segment], 0,
      () => observeRoleSkillSlots(state, previous, catalog, {
        stage: 3, local: true, stop: () => {}, recompute: apply,
      })), true);
  };
  receive(new Uint8Array(row.bytes));
  assert.deepEqual([...slots], row.values);
  assert.equal(health.hp, 777);
  assert.equal(state.dirty, false);
  receive(encodeRoleArrayProperty(31, field, 1));
  assert.equal(recomputed.length, 2);
  assert.equal(recomputed[0], recomputed[1], 'Repeated property notification recomputes from base, without accumulating twice');
  cases++;
}
console.log(`PASS: ${cases} all342-skill network slot batches recompute MaxHP from base without changing current HP`);
