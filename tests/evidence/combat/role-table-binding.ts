import type {RoleTankBaseDefinition} from '../../../apps/shared/contracts/role-base';
import type {RolePetBaseDefinition} from '../../../apps/shared/contracts/role-base';

export interface RoleTableBinding {
  tank?: RoleTankBaseDefinition;
  pet?: RolePetBaseDefinition;
}

/** Original426509–42653f: pet first, tank second; missing rows preserve existing pointers. */
export function bindRoleSourceTables(binding: RoleTableBinding,
    message: {field68: number; field78: number},
    lookupPet: (id: number) => RolePetBaseDefinition | undefined,
    lookupTank: (id: number) => RoleTankBaseDefinition | undefined): void {
  const pet = lookupPet(message.field78 | 0);
  if (pet) binding.pet = pet;
  const tank = lookupTank(message.field68 | 0);
  if (tank) binding.tank = tank;
}
