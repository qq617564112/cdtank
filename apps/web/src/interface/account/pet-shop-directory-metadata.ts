import {gameContent} from '../../../../shared/content/catalog';

export function petShopDirectoryDetails(petId: number) {
  const content = gameContent(), pet = content.pets.get(petId);
  if (!pet) return;
  return {critical: pet.attributes.critical, lucky: pet.attributes.lucky,
    skills: pet.skills.map(skill => ({id: skill.baseId, level: skill.rankCap,
      name: content.skills.get(skill.baseId)?.name ?? skill.name ?? ''}))};
}
