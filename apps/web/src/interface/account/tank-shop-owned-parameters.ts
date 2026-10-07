import type {OwnedRoleRecordData, ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {ResOwnedRoleSale} from '../../../../shared/protocols/PtlOwnedRoleSale';
import type {ResEquipment} from '../../../../shared/protocols/PtlEquipment';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {rankedPetSkillId} from '../../../../shared/content/catalog';
import {homeTankParameters, type HomeTankParameters} from '../home/home-tank-parameters';

/** Confirmed sources behind the Shop Owned five-parameter projection. */
export interface TankShopOwnedParameterSources {
  owned?: ResOwnedRoles;
  record?: OwnedRoleRecordData;
  profile?: ResOwnedRoleSale['profile'];
  /** Equipment query already qualified against the current owned selection. */
  partEquipment?: ResEquipment;
  inventory?: ResInventory;
  catalog?: CombatCatalog;
}

/** Confirms every non-empty skill in an item has a real catalog definition. */
function itemSkillChainConfirmed(catalog: CombatCatalog, itemId: number): boolean {
  if (itemId === 0) return true;
  const item = catalog.items.find(value => value.itemTableId === itemId);
  if (!item) return false;
  return item.skillIds.every(skillId => skillId === 0
    || catalog.skills.some(value => value.skillId === skillId));
}

/**
 * Original Shop Owned mode reads the same `429e41` aggregate as Home. The current
 * pet and the five installed part instances come from the confirmed profile; the
 * owned tank record supplies the aggregate input. Any missing confirmed source
 * leaves the five controls blank instead of falling back to the buy catalogue.
 */
export function tankShopOwnedParameters({owned, record, profile, partEquipment, inventory, catalog}:
    TankShopOwnedParameterSources): HomeTankParameters | undefined {
  if (!owned || !record || !profile || !partEquipment || !inventory || !catalog) return undefined;
  const fields = new Map(record.fields);
  const instanceId = fields.get(0x1c);
  if (instanceId === undefined) return undefined;
  const view = new DataView(Uint8Array.from(profile.bytes).buffer);
  const currentPet = view.getUint32(0xa4, true);
  const pet = owned.base.find(value => new Map(value.fields).get(0) === currentPet);
  if (!pet) return undefined;
  const petFields = new Map(pet.fields);
  const alreadyUsed = view.getUint32(0xa8, true) === instanceId;
  if (alreadyUsed) {
    for (let slot = 0; slot < 6; slot++) {
      const baseId = petFields.get(0x44 + slot * 4), rank = petFields.get(0x5c + slot * 4);
      if (baseId === undefined || rank === undefined) return undefined;
      if (baseId === 0 || rank === 0) continue;
      const skillId = rankedPetSkillId(baseId, rank);
      if (skillId === undefined || !catalog.skills.some(value => value.skillId === skillId)) return undefined;
    }
  }
  for (const offset of [0x58, 0x5c, 0x60]) {
    const itemId = fields.get(offset);
    if (itemId === undefined) return undefined;
    if (!itemSkillChainConfirmed(catalog, itemId)) return undefined;
  }
  const installed = new Set(Array.from({length: 5}, (_, slot) => view.getUint32(0x148 + slot * 4, true)));
  const equippedItemIds = inventory.records
    .filter(entry => installed.has(entry.instanceId) && entry.state === 2 && entry.ownedQuantity > 0)
    .map(entry => entry.itemTableId);
  if (alreadyUsed && !equippedItemIds.every(itemId => itemSkillChainConfirmed(catalog, itemId))) return undefined;
  return homeTankParameters(record, pet, catalog, equippedItemIds, alreadyUsed);
}
