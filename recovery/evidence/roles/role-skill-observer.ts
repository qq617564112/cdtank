import type {RoleCombatState} from '../../../apps/server/src/battle/roles/combat-state';

/** Original42f385 property31 branch, with effect stop and stat recompute supplied. */
export function observeRoleSkillSlots(
  state: RoleCombatState | undefined,
  previous: Int32Array,
  catalog: ReadonlyMap<number, {skillId: number; triggerType: number}>,
  handlers: {stage: number; local: boolean; stop(skillId: number): void; recompute(): void},
): void {
  if (handlers.stage === 1 || !state) return;
  const current = state.record!.arrays.get(4)!;
  for (let slot = 0; slot < 16; slot++) {
    const id = previous[slot]!;
    if (!id || current.includes(id)) continue;
    const skill = catalog.get(id);
    if (skill && (skill.triggerType === 2 || skill.triggerType === 3)) {
      handlers.stop(skill.skillId);
    }
  }
  previous.set(current.subarray(0, 16));
  if (handlers.local) {
    state.dirty = true;
    handlers.recompute();
  }
}
