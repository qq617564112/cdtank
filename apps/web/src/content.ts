import {GameContent, installGameContent} from '../../shared/content/catalog';
import type {ContentIndex, ItemDefinition, PetDefinition, SkillDefinition, TankDefinition} from '../../shared/content/types';
import {loadStaticJson} from './assets/static-resources';

let loading: Promise<GameContent> | undefined;
let prepared: GameContent | undefined;
export function prepareGameContent(): Promise<GameContent> {
  return loading ??= (async () => {
    const index = await loadStaticJson<ContentIndex>('/content/index.json');
    const read = <T>(filename: string) => loadStaticJson<T>(`/content/${filename}`);
    const [pets, tanks, items, skills] = await Promise.all([
      Promise.all(index.pets.map(read<PetDefinition>)), Promise.all(index.tanks.map(read<TankDefinition>)),
      Promise.all(index.items.map(read<ItemDefinition>)), Promise.all(index.skills.map(read<SkillDefinition>)),
    ]);
    const content = new GameContent(index, pets, tanks, items, skills);
    installGameContent(content);
    prepared = content;
    return content;
  })().catch(error => {loading = undefined; throw error;});
}

export async function loadCombatCatalog() {return (await prepareGameContent()).combatCatalog;}
export function preparedGameContent(): GameContent | undefined {return prepared;}
export function preparedCombatCatalog(): GameContent['combatCatalog'] | undefined {return prepared?.combatCatalog;}
export function preparedTankTextureCatalog(): {rows: TankDefinition['resources']['textureVariants']} | undefined {
  return prepared ? {rows: [...prepared.tanks.values()].flatMap(tank => tank.resources.textureVariants)} : undefined;
}
export async function loadTankTextureCatalog() {
  await prepareGameContent();
  return preparedTankTextureCatalog()!;
}
