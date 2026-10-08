import {gameContent} from '../../../../shared/content/catalog';

export function sourcePetDescription(definitionId?: number): string | undefined {
  return definitionId === undefined ? undefined : gameContent().pets.get(definitionId)?.description;
}
export function sourceTankDescription(definitionId?: number): string | undefined {
  return definitionId === undefined ? undefined : gameContent().tanks.get(definitionId)?.description;
}
