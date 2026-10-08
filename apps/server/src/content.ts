import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {GameContent, installGameContent} from '../../shared/content/catalog';
import type {ContentIndex, ItemDefinition, PetDefinition, SkillDefinition, TankDefinition} from '../../shared/content/types';

const root = resolve(__dirname, '../../shared/content/definitions');
const read = <T>(filename: string): T => JSON.parse(readFileSync(resolve(root, filename), 'utf8')) as T;
const index = read<ContentIndex>('index.json');
export const content = new GameContent(index, index.pets.map(read<PetDefinition>),
  index.tanks.map(read<TankDefinition>), index.items.map(read<ItemDefinition>),
  index.skills.map(read<SkillDefinition>));
installGameContent(content);
