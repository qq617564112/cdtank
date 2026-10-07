import type {OwnedRoleRecordData, ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {ResOwnedRoleSale} from '../../../../shared/protocols/PtlOwnedRoleSale';
import type {ResEquipment} from '../../../../shared/protocols/PtlEquipment';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
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

/**
 * Original Shop Owned mode reads the same `429e41` aggregate as Home. The current
 * pet and the five installed part instances come from the confirmed profile; the
 * owned tank record supplies the aggregate input. Any missing confirmed source
 * leaves the five controls blank instead of falling back to the buy catalogue.
 */
export function tankShopOwnedParameters({owned, record, profile, partEquipment, inventory, catalog}:
    TankShopOwnedParameterSources): HomeTankParameters | undefined {
  if (!owned || !record || !profile || !partEquipment || !inventory || !catalog) return undefined;
  const instanceId = new Map(record.fields).get(0x1c);
  if (instanceId === undefined) return undefined;
  const view = new DataView(Uint8Array.from(profile.bytes).buffer);
  const currentPet = view.getUint32(0xa4, true);
  const pet = owned.base.find(value => new Map(value.fields).get(0) === currentPet);
  if (!pet) return undefined;
  const installed = new Set(Array.from({length: 5}, (_, slot) => view.getUint32(0x148 + slot * 4, true)));
  const equippedItemIds = inventory.records
    .filter(entry => installed.has(entry.instanceId) && entry.state === 2 && entry.ownedQuantity > 0)
    .map(entry => entry.itemTableId);
  return homeTankParameters(record, pet, catalog, equippedItemIds,
    view.getUint32(0xa8, true) === instanceId);
}
