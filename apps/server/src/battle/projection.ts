import type {PlayerState} from './player-state';
import type {AccountInventory} from '../account-store';
import {selectRoleItemSkills} from './roles/skills';
import {readRoleSkillSources} from './roles/skill-sources';
import {readEquippedMarkerItemIds} from './roles/marker-skills';
import {combatSkills, combatItemSkills} from './catalog';

export function battleAttributes(player: PlayerState) {
  const values = player.attributes.values;
  return {ready: player.attributesReady, magazineReady: player.magazineReady,
    armorReady: player.armorReady, recoveredArmor: player.recoveredArmor,
    lifeReady: player.lifeReady, maxHp: player.attributes.record.maxHp,
    maxBullet: player.combat.maxBulletCount, normalReloadSeconds: player.combat.roleFloatFields.get(0x50),
    recordFields: values ? Object.fromEntries(values.recordFields) : undefined,
    roleIntegers: values ? Object.fromEntries(values.roleIntegers) : undefined,
    roleFloats: values ? Object.fromEntries(player.combat.roleFloatFields) : undefined};
}

export function battlePartSources(player: PlayerState): {tableIds: number[]; passiveSkillIds: number[]} {
  const tableIds = [...player.combat.record!.arrays.get(2)!].map(value => value >>> 0);
  const passiveSkillIds = selectRoleItemSkills(tableIds, [...player.combat.record!.arrays.get(4)!],
    combatSkills, combatItemSkills).map(skill => skill.skillId);
  return {tableIds, passiveSkillIds};
}

export function battleSkillSources(player: Pick<PlayerState, 'boundGear' | 'inventory'> & {
  ownedRoles: Pick<PlayerState['ownedRoles'], 'snapshot'> &
    {equipment?: PlayerState['ownedRoles']['equipment']};
  combat: {attributeSourceFields(): ReadonlyMap<number, number> | undefined;
    record?: {arrays: ReadonlyMap<number, ArrayLike<number>>}};
}): ReturnType<typeof readRoleSkillSources> | undefined {
  const equipment = player.ownedRoles.snapshot().equipment;
  if (typeof player.ownedRoles.equipment !== 'function') return undefined;
  const profile = player.ownedRoles.equipment();
  const fields = player.combat.attributeSourceFields();
  if (!equipment || !fields || ![0x58, 0x5c, 0x60].every(offset => equipment.fields.has(offset))) return undefined;
  // The reconstructed selected-pet binding stays separate from owned manager sources.
  return {...readRoleSkillSources({currentSkillIds: Array.from(player.combat.record!.arrays.get(4)!),
    boundGear: player.boundGear, equipment, roleFields: fields}),
    markerItemIds: readEquippedMarkerItemIds(profile.marks, player.inventory, combatItemSkills)};
}

export function battleInventory(player: PlayerState): AccountInventory {
  return {records: player.inventory.map(record => ({...record})),
    hotkeys: [...player.combat.record!.arrays.get(0)!].map(value => value >>> 0)};
}
