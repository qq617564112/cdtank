import {content} from '../content';
import {TANKS} from '../config';
import {bindOwnedBattleSources, selectBattleTank} from '../battle/preparation';
import {TITLE_DEFINITIONS} from '../settlement/title';
import {randomCpuName} from './cpu-names';
import {newbornBattleSources} from '../../../shared/simulation/newborn-roles';
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
  selectBattleTank(room, cpu, tank);
  bindOwnedBattleSources(room, cpu, newbornBattleSources(definition, pet, textures));
  cpu.cpuPetId = pet.id;
  cpu.name = randomCpuName([...room.players.values()].map(player => player.name));
  const title = TITLE_DEFINITIONS[Math.floor(Math.random() * TITLE_DEFINITIONS.length)];
  cpu.title = {id: title.id, name: title.name};
}
