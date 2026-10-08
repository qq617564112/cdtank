import {gameContent} from '../../../../shared/content/catalog';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleSkillRecord} from '../../../../shared/contracts/role-skills';
import type {RoleItemSkills} from './skills';


/** Resolve Home profile marks through owned inventory; instance IDs never stand in for table or skill IDs. */
export function readEquippedMarkerItemIds(instanceIds: readonly number[],
    inventory: readonly InventoryWireRecord[],
    items: ReadonlyMap<number, RoleItemSkills>): number[] {
  const itemIds: number[] = [];
  for (const instanceId of instanceIds) {
    const id = instanceId >>> 0;
    if (!id) continue;
    const record = inventory.find(entry => (entry.instanceId >>> 0) === id);
    if (!record || (record.ownedQuantity >>> 0) <= 0) continue;
    const itemId = record.itemTableId >>> 0;
    if (!gameContent().items.get(itemId)?.runtime.markerReward || !items.has(itemId)) continue;
    itemIds.push(itemId);
  }
  return itemIds;
}

/** Func19 markers use their exact item-skill expansion without changing the legacy Func1 passive gate. */
export function selectRoleMarkerSkills<T extends RoleSkillRecord>(markerItemIds: readonly number[],
    currentSkillIds: readonly number[], catalog: ReadonlyMap<number, T>,
    items?: ReadonlyMap<number, RoleItemSkills>): T[] {
  const selected: T[] = [];
  const slots = currentSkillIds.slice(0, 16);
  for (const itemId of markerItemIds) {
    const item = items?.get(itemId);
    for (const skillId of item?.skillIds.slice(0, 3) ?? []) {
      const skill = catalog.get(skillId);
      if (skill && !slots.includes(skill.skillId) && isMarkerRewardRoleSkill(skill)) selected.push(skill);
    }
  }
  return selected;
}

export function isMarkerRewardRoleSkill(skill: RoleSkillRecord | undefined): boolean {
  return skill !== undefined && skill.triggerType === 0
    && skill.functions.some(fn => fn.type === 19);
}
