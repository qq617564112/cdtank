import type {OwnedRoleBaseRecord} from '../../../../shared/contracts/owned-base';
import type {OwnedRoleEquipmentRecord} from '../../../../shared/contracts/owned-equipment';

export interface RoleOwnedSources {
  base: OwnedRoleBaseRecord | undefined;
  equipment: OwnedRoleEquipmentRecord | undefined;
}

/** Original422f66 stores message+10/+c at manager+20/+24, preserving message references. */
export function receiveRoleOwnedPair(owner: RoleOwnedSources, message: RoleOwnedSources): void {
  owner.base = message.base;
  owner.equipment = message.equipment;
}

