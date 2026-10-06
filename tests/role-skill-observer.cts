import type {RoleSkillRecord} from '../apps/shared/contracts/role-skills';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observeRoleSkillSlots} from '../recovery/evidence/roles/role-skill-observer';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {encodeRoleArrayProperty, receiveRoleArrayProperties} from '../recovery/evidence/combat/role-array-property';
import {selectRoleSkills} from '../apps/server/src/battle/roles/skills';

interface ObserverState {previous: number[]; dirty: boolean}
interface ObserverEvent {kind: 'stop' | 'recompute'; skillId?: number; state: ObserverState}
const evidence: {
  catalog: {skillId: number; triggerType: number}[];
  rows: {
    previous: number[]; current: number[]; local: boolean; stage: number; present: boolean;
    result: ObserverState; events: ObserverEvent[];
  }[];
} = JSON.parse(readFileSync('recovery/output/role-skill-observer-native.json', 'utf8'));
const catalog = new Map(evidence.catalog.map(skill => [skill.skillId, skill]));
for (const row of evidence.rows) {
  const state = createRoleCombatState();
  state.dirty = false;
  state.record!.arrays.get(4)!.set(row.current);
  const previous = new Int32Array(row.previous);
  const snapshot = (): ObserverState => ({previous: [...previous], dirty: state.dirty});
  const events: ObserverEvent[] = [];
  observeRoleSkillSlots(row.present ? state : undefined, previous, catalog, {
    stage: row.stage, local: row.local,
    stop: skillId => { events.push({kind: 'stop', skillId, state: snapshot()}); },
    recompute: () => { events.push({kind: 'recompute', state: snapshot()}); },
  });
  assert.deepEqual(snapshot(), row.result);
  assert.deepEqual(events, row.events);
}
console.log(`PASS: ${evidence.rows.length} complete skill-slot observer cases match original x86`);

const arrays: {
  arraySkillCatalog: RoleSkillRecord[];
  arrayReceiveRows: {observer: boolean; segments: number[][]; before: Record<string, number[]>;
    accepted: boolean; result: Record<string, number[]>}[];
} = JSON.parse(readFileSync('recovery/output/role-properties-native.json', 'utf8'));
const fullCatalog = new Map(arrays.arraySkillCatalog.map(skill => [skill.skillId, skill]));
let combinations = 0;
for (const row of arrays.arrayReceiveRows) {
  if (row.segments.some(segment => segment[1] !== 31)) continue;
  for (const local of [false, true]) {
    const state = createRoleCombatState();
    state.dirty = false;
    const current = state.record!.arrays.get(4)!;
    current.set(row.before['31']);
    const previous = current.slice();
    const bytes = new Uint8Array(current.buffer, current.byteOffset, current.byteLength);
    const field = {width: 4 as const, count: 16, bytes, snapshot: bytes.slice()};
    const selected: number[][] = [];
    const stops: number[] = [];
    const accepted = receiveRoleArrayProperties(new Map([[31, field]]),
      row.segments.map(segment => new Uint8Array(segment)), 0x11223344,
      row.observer ? () => observeRoleSkillSlots(state, previous, fullCatalog, {
        stage: 3, local,
        stop: skillId => { stops.push(skillId); },
        recompute: () => {
          assert.equal(state.needsRecompute(), true);
          selected.push(selectRoleSkills({currentSkillIds: [...current],
            extraSkill: {baseId: 0, rank: 0}}, fullCatalog).map(skill => skill.skillId));
          state.finishRecompute();
        },
      }) : undefined);
    assert.equal(accepted, row.accepted);
    assert.deepEqual([...current].map(value => value >>> 0), row.result['31']);
    assert.equal(state.dirty, false);
    const successful = row.segments.filter(segment => [1, 2, 3].includes(segment[4]!));
    assert.equal(selected.length, row.observer && local ? successful.length : 0);
    if (row.observer) assert.deepEqual([...previous], [...current]);
    else assert.deepEqual([...previous], row.before['31']);
    if (selected.length) {
      assert.deepEqual(selected.at(-1), row.result['31'].filter(id => fullCatalog.has(id)));
    }
    // Re-sending the current full slots must not stop any skill still present.
    const beforeStops = stops.length;
    receiveRoleArrayProperties(new Map([[31, field]]), [encodeRoleArrayProperty(31, field, 1)], 0,
      row.observer ? () => observeRoleSkillSlots(state, previous, fullCatalog, {
        stage: 3, local, stop: skillId => { stops.push(skillId); }, recompute: () => state.finishRecompute(),
      }) : undefined);
    assert.equal(stops.length, beforeStops);
    combinations++;
  }
}
console.log(`PASS: ${combinations} network arrays → skill observer → production selection/completion combinations`);
