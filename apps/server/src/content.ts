import {readSimulationContent} from './runtime/simulation-host';
import {GameContent, installGameContent} from '../../shared/content/catalog';
import type {ContentIndex, ItemDefinition, PetDefinition, SkillDefinition, TankDefinition} from '../../shared/content/types';

const read = readSimulationContent;
const index = read<ContentIndex>('index.json');
export const content = new GameContent(index, index.pets.map(read<PetDefinition>),
  index.tanks.map(read<TankDefinition>), index.items.map(read<ItemDefinition>),
  index.skills.map(read<SkillDefinition>));
installGameContent(content);
