import type {OwnedRoleBaseRecord} from '../../apps/shared/contracts/owned-base';

/** Rebuilt binding from an ownership-validated selection; original +a0 producer is unknown. */
export function freezeSelectedBoundSource(
    selected: OwnedRoleBaseRecord | undefined): OwnedRoleBaseRecord | undefined {
  if (!selected) return undefined;
  for (let slot = 0; slot < 6; slot++) {
    if (!selected.fields.has(0x44 + slot * 4) || !selected.fields.has(0x5c + slot * 4)) {
      return undefined;
    }
  }
  return {name: selected.name, fields: new Map(selected.fields)};
}
