import type {PetDefinition, TankDefinition} from '../content/types';
import type {OwnedTankTextures} from '../combat/role-owned-textures';
import type {OwnedRoleBaseRecord} from '../contracts/owned-base';
import type {OwnedRoleEquipmentRecord} from '../contracts/owned-equipment';

/** Newborn battle roles use the same recovered fields for CPUs and local training. */
export function newbornBattleSources(tank: TankDefinition, pet: PetDefinition,
  textures: OwnedTankTextures = tank.textures): {base: OwnedRoleBaseRecord; equipment: OwnedRoleEquipmentRecord} {
  const baseFields = new Map<number, number>();
  for (const offset of [4, 0, 8, 0x84, 0x34, 0x38, 0x8c, 0x80, 0x88, 0x7c,
    0x3c, 0x40, 0x2c, 0x30, 0x94, 0x28, 0x90, 0x74, 0x78]) baseFields.set(offset, 0);
  baseFields.set(0, 1);
  baseFields.set(8, pet.id);
  baseFields.set(0x2c, pet.attributes.maxHp);
  baseFields.set(0x34, pet.attributes.critical);
  baseFields.set(0x3c, pet.attributes.lucky);
  for (let slot = 0; slot < 6; slot++) {
    baseFields.set(0x44 + slot * 4, pet.skills[slot].baseId);
    baseFields.set(0x5c + slot * 4, pet.skills[slot].initialRank);
  }
  const equipmentFields = new Map<number, number>();
  for (let offset = 0x1c; offset <= 0x6c; offset += 4) equipmentFields.set(offset, 0);
  // CPU item configuration reserves instance IDs 2 through 8.
  for (const [offset, value] of [[0x1c, 9], [0x24, tank.id],
    [0x28, textures.U], [0x2c, textures.M], [0x30, textures.XY],
    [0x3c, tank.attributes.attack], [0x40, tank.attributes.attackBonus],
    [0x4c, tank.attributes.defense], [0x50, tank.attributes.defenseBonus], [0x6c, tank.partCapacity]]) {
    equipmentFields.set(offset, value);
  }
  return {base: {name: pet.name, fields: baseFields}, equipment: {name: tank.name, fields: equipmentFields}};
}
