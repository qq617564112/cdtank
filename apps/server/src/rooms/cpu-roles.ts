import {content} from '../content';
import {TANKS} from '../config';
import {bindOwnedBattleSources, selectBattleTank} from '../battle/preparation';
import {TITLE_DEFINITIONS} from '../settlement/title';
import {randomCpuName} from './cpu-names';
import type {TankDefinition} from '../../../shared/content/types';
import type {OwnedTankTextures} from '../../../shared/combat/role-owned-textures';
import type {PlayerState} from '../battle/player-state';
import type {RoomState} from './state';

/** Match turret and hull paints; tracks have their own published palette. */
function randomCpuTankTextures(tank: TankDefinition): OwnedTankTextures {
  const textures = {...tank.textures};
  const components = tank.resources.components.filter(component => component.actions.length > 0)
    .map(component => component.part);
  const rows = tank.resources.textureVariants.filter(row => {
    const present = row.part === 'XY' ? components.includes('X') || components.includes('Y')
      : components.includes(row.part);
    const variants = row.part === 'XY' ? [row.textures.A, row.textures.B] : [row.textures.A];
    return row.tankId === tank.id && row.selectable && present
      && variants.every(texture => texture?.status === 'resolved' && texture.asset);
  });
  const hulls = rows.filter(row => row.part === 'M');
  const turrets = rows.filter(row => row.part === 'U');
  const paints = hulls.filter(row => !components.includes('U')
    || turrets.some(turret => turret.name === row.name));
  if (paints.length) {
    const paint = paints[Math.floor(Math.random() * paints.length)];
    textures.M = paint.recordId;
    const turret = turrets.find(row => row.name === paint.name);
    if (turret) textures.U = turret.recordId;
  }
  const tracks = rows.filter(row => row.part === 'XY');
  if (tracks.length) textures.XY = tracks[Math.floor(Math.random() * tracks.length)].recordId;
  return textures;
}

/** Room-local newborn roles use the same source fields and binding as players. */
export function assignRandomCpuRoles(room: RoomState, cpu: PlayerState): void {
  const pets = [...content.pets.values()];
  const pet = pets[Math.floor(Math.random() * pets.length)];
  const tank = TANKS[Math.floor(Math.random() * TANKS.length)];
  const definition = content.tanks.get(tank.id)!;
  const textures = randomCpuTankTextures(definition);
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
    [0x28, textures.U], [0x2c, textures.M],
    [0x30, textures.XY], [0x3c, definition.attributes.attack],
    [0x40, definition.attributes.attackBonus], [0x4c, definition.attributes.defense],
    [0x50, definition.attributes.defenseBonus], [0x6c, definition.partCapacity]]) {
    equipmentFields.set(offset, value);
  }

  selectBattleTank(room, cpu, tank);
  bindOwnedBattleSources(room, cpu, {
    base: {name: pet.name, fields: baseFields},
    equipment: {name: tank.name, fields: equipmentFields},
  });
  cpu.cpuPetId = pet.id;
  cpu.name = randomCpuName([...room.players.values()].map(player => player.name));
  const title = TITLE_DEFINITIONS[Math.floor(Math.random() * TITLE_DEFINITIONS.length)];
  cpu.title = {id: title.id, name: title.name};
}
