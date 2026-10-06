import type {RoleOwnedSources} from './accounts/owned/receive-pair';
import {receiveRoleOwnedPair} from './accounts/owned/receive-pair';
import {resolveOwnedRolePet, resolveOwnedRoleTank} from './accounts/owned/definition';
import {PET_BASES, TANKS} from './config';
import type {RoleProfilePayload} from './accounts/profile/payload';
import {readRoleProfileEquipment} from './accounts/profile/equipment';
import {readRoleProfileCosmetics} from './accounts/profile/cosmetics';

export interface BattleEquipmentSources {
  decorationInstanceId: number;
  marks: number[];
  parts: number[];
}

/** Rebuilt account-to-battle ownership boundary. Does not invent bound gear or skill slots. */
export class BattleRoleSources {
  private readonly owned: RoleOwnedSources = {base: undefined, equipment: undefined};
  private equipmentProfile: BattleEquipmentSources = {decorationInstanceId: 0,
    marks: [0, 0, 0], parts: [0, 0, 0, 0, 0]};

  replaceProfile(profile: RoleProfilePayload | undefined): boolean {
    const view = profile ? new DataView(profile.bytes.buffer, profile.bytes.byteOffset,
      profile.bytes.byteLength) : undefined;
    const next: BattleEquipmentSources = profile ? {
      decorationInstanceId: readRoleProfileCosmetics(profile).skinInstanceId,
      marks: Array.from({length: 3}, (_, slot) => view!.getUint32(0x13c + slot * 4, true)),
      parts: readRoleProfileEquipment(profile),
    } : {decorationInstanceId: 0, marks: [0, 0, 0], parts: [0, 0, 0, 0, 0]};
    const current = this.equipmentProfile;
    const changed = current.decorationInstanceId !== next.decorationInstanceId ||
      current.marks.some((value, slot) => value !== next.marks[slot]) ||
      current.parts.some((value, slot) => value !== next.parts[slot]);
    this.equipmentProfile = next;
    return changed;
  }

  equipment(): BattleEquipmentSources {
    return {...this.equipmentProfile, marks: [...this.equipmentProfile.marks],
      parts: [...this.equipmentProfile.parts]};
  }

  replace(sources: RoleOwnedSources): boolean {
    const previous = this.owned;
    const same = (left: RoleOwnedSources['base'], right: RoleOwnedSources['base']): boolean => {
      if (!left || !right) return left === right;
      return left.name === right.name && left.fields.size === right.fields.size &&
        [...left.fields].every(([offset, value]) => right.fields.get(offset) === value);
    };
    const changed = !same(previous.base, sources.base) || !same(previous.equipment, sources.equipment);
    // Persisted maps and room objects have independent lifetimes.
    receiveRoleOwnedPair(this.owned, {
      base: sources.base ? {name: sources.base.name, fields: new Map(sources.base.fields)} : undefined,
      equipment: sources.equipment ? {name: sources.equipment.name, fields: new Map(sources.equipment.fields)} : undefined,
    });
    return changed;
  }

  snapshot(): RoleOwnedSources {
    return {
      base: this.owned.base ? {name: this.owned.base.name, fields: new Map(this.owned.base.fields)} : undefined,
      equipment: this.owned.equipment ? {name: this.owned.equipment.name, fields: new Map(this.owned.equipment.fields)} : undefined,
    };
  }

  tables(): {tank: (typeof TANKS)[number] | undefined; pet: (typeof PET_BASES)[number] | undefined} {
    const base = this.owned.base, equipment = this.owned.equipment;
    return {
      tank: equipment ? resolveOwnedRoleTank(new Map([[equipment.fields.get(0x1c)! >>> 0, equipment]]),
        equipment.fields.get(0x1c)!, id => TANKS.find(tank => tank.id === id)) : undefined,
      pet: base ? resolveOwnedRolePet(new Map([[base.fields.get(0)! >>> 0, base]]),
        base.fields.get(0)!, id => PET_BASES.find(pet => pet.id === id)) : undefined,
    };
  }
}
