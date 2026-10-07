import {gameContent, rankedPetSkillId} from '../../../../shared/content/catalog';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';

/** Original PetTable +7c..+88 mastery order; the four bars use the same slot order. */
const MASTERY_ATTRIBUTES = ['STankMastery', 'MTankMastery', 'LTankMastery', 'StugMastery'] as const;

/** Original 429e41 sink order: prgLightTank/prgMediumTank/prgHeavyTank/prgCruiser. */
const HOME_PET_MASTERY_CONTROLS = [
  {name: 'prgLightTank', label: '轻型坦克熟练度'},
  {name: 'prgMediumTank', label: '中型坦克熟练度'},
  {name: 'prgHeavyTank', label: '重型坦克熟练度'},
  {name: 'prgCruiser', label: '巡洋坦克熟练度'},
] as const;

export interface HomePetOwnedMasteryValues {
  mastery: readonly number[];
  /** Original f32(mastery * f32 0.2); the visual clip is applied by the view. */
  progress: readonly number[];
}

/**
 * Original 429e41 Home pet projection: selected PetTable base plus passive mastery from
 * the selected pet's own six skills and the current tank's three internal part items,
 * then the same-session five equipped instances only while the selected pet is current.
 * Unresolved records stay unknown rather than falling back to the buy-directory value.
 */
export function homePetOwnedMastery({selectedBase, currentTank, currentPetInstance, equippedItemIds, catalog}:
    {selectedBase?: OwnedRoleRecordData; currentTank?: OwnedRoleRecordData; currentPetInstance?: number;
      equippedItemIds?: readonly number[]; catalog?: CombatCatalog}): HomePetOwnedMasteryValues | undefined {
  // The current pet must be identified before the five-item component can be admitted or
  // skipped; an unconfirmed identity cannot be treated as non-current.
  if (!selectedBase || !currentTank || !catalog || currentPetInstance === undefined) return undefined;
  const fields = new Map(selectedBase.fields), tankFields = new Map(currentTank.fields);
  const definitionId = fields.get(8);
  const base = definitionId === undefined ? undefined : gameContent().pets.get(definitionId)?.attributes.mastery;
  if (!base || base.length < MASTERY_ATTRIBUTES.length) return undefined;
  const mastery = base.slice(0, MASTERY_ATTRIBUTES.length);
  const addSkill = (skillId: number) => {
    const skill = catalog.skills.find(value => value.skillId === skillId);
    if (!skill) return false;
    if (skill.triggerType !== 0) return true;
    MASTERY_ATTRIBUTES.forEach((attribute, index) => {
      mastery[index] = (mastery[index]! + (skill.attributes[attribute] ?? 0)) | 0;
    });
    return true;
  };
  const addItem = (itemId: number) => {
    const item = catalog.items.find(value => value.itemTableId === itemId);
    if (!item) return false;
    return item.skillIds.every(skillId => skillId === 0 || addSkill(skillId));
  };
  // Selected pet six skills, unconditional even for a non-current candidate.
  for (let slot = 0; slot < 6; slot++) {
    const baseId = fields.get(0x44 + slot * 4), rank = fields.get(0x5c + slot * 4);
    if (baseId === undefined || rank === undefined) return undefined;
    if (baseId === 0 || rank === 0) continue;
    const skillId = rankedPetSkillId(baseId, rank);
    if (skillId === undefined || !addSkill(skillId)) return undefined;
  }
  // Current tank three internal part items, unconditional.
  for (const offset of [0x58, 0x5c, 0x60]) {
    const itemId = tankFields.get(offset);
    if (itemId === undefined) return undefined;
    if (itemId === 0) continue;
    if (!addItem(itemId)) return undefined;
  }
  // Web adoption of the original role-skill-table component: same-session five equipped
  // instances, only while the selected pet is the confirmed current pet.
  if (currentPetInstance === fields.get(0)) {
    if (equippedItemIds === undefined) return undefined;
    for (const itemId of equippedItemIds) {
      if (itemId === 0) continue;
      if (!addItem(itemId)) return undefined;
    }
  }
  const durability = tankFields.get(0x34);
  if (durability === undefined) return undefined;
  const tankType = catalog.tankTypes?.find(value => value.tankId === tankFields.get(0x24))?.tankType;
  if (tankType === undefined || tankType < 1 || tankType > 4) return undefined;
  if (durability === 0) mastery[tankType - 1] = (mastery[tankType - 1]! - 1) | 0;
  return {mastery, progress: mastery.map(value => Math.fround(value * Math.fround(0.2)))};
}

/** Renders the four original pet mastery ProgressBars at their source controls. */
export function HomePetOwnedMastery({ui, selectedBase, currentTank, currentPetInstance, equippedItemIds, catalog}: {
  ui: HomeSourceUi; selectedBase?: OwnedRoleRecordData; currentTank?: OwnedRoleRecordData;
  currentPetInstance?: number; equippedItemIds?: readonly number[]; catalog?: CombatCatalog;
}) {
  const values = homePetOwnedMastery({selectedBase, currentTank, currentPetInstance, equippedItemIds, catalog});
  if (!values) return null;
  const suffix = 'myhome_petpage.xml', layout = new HomeSourceLayout(ui, suffix);
  return <>
    {HOME_PET_MASTERY_CONTROLS.map(({name, label}, index) => {
      const control = layout.control(name);
      const bounds = sourceProps(ui, layout, suffix, name, control.properties.BackgroundImage);
      const fill = sourceProps(ui, layout, suffix, name, control.properties.ProgressImage);
      const value = values.mastery[index]!, fraction = Math.max(0, Math.min(1, values.progress[index]!));
      const width = Number(bounds.style.width), height = Number(bounds.style.height);
      const extent = Math.floor(width * fraction + .5);
      return <div key={name} {...bounds} style={{...bounds.style, pointerEvents: 'none'}}
        className="home-pet-mastery-progress" data-home-pet-mastery-progress={name}
        data-mastery-value={value} data-mastery-fraction={values.progress[index]}
        role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(5, value)} aria-valuenow={value}>
        <span aria-hidden="true" style={{position: 'absolute', inset: 0, width, height,
          clipPath: `inset(0 ${width - extent}px 0 0)`, backgroundImage: fill.style.backgroundImage,
          backgroundSize: '100% 100%'}} />
      </div>;
    })}
  </>;
}
