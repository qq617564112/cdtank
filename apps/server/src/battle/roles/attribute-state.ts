import {recomputeRoleAttributes} from './recompute';
import type {RoleRecomputeValues} from './recompute-base';
import {setRoleMovementProperty, type RoleMovementRecord} from './movement-setter';
import {markRolePropertyDirty} from './property-dirty';
import type {RoleCombatState} from './combat-state';
import {missingRoleRecomputeSource} from './recompute-readiness';
import type {RoleItemSkills} from './skills';

type CompleteInput = Parameters<typeof recomputeRoleAttributes>[0];
type SourceName = 'base' | 'equipment' | 'tank' | 'pet' | 'skills' | 'items';
export type RoleAttributeInput = Omit<CompleteInput, SourceName> & {
  [Name in SourceName]: CompleteInput[Name] | undefined;
} & {
  /** Original fifth argument is required by the prefix, but not invoked by433466. */
  itemResolver: ((instanceId: number) => RoleItemSkills | undefined) | undefined;
};

/** Stateful role attributes; source ownership is resolved before calling recompute. */
export class RoleAttributeState {
  dirty = true;
  readonly propertyDirty = new Uint32Array(8);
  values: RoleRecomputeValues | undefined;

  constructor(readonly record: RoleMovementRecord & {hp: number; maxHp: number; maxBullet: number},
      private readonly notified: (index: 9 | 10 | 13 | 5, state: RoleAttributeState) => void) {}

  recompute(input: RoleAttributeInput, role?: RoleCombatState): boolean {
    // Original missing-source diagnostic returns before all role/record writes.
    if (missingRoleRecomputeSource(input)) return false;
    if (role) this.dirty = role.dirty;
    const publish = (values: RoleRecomputeValues): void => {
      this.values = values;
      if (role) for (const [offset, value] of values.roleFloats) role.roleFloatFields.set(offset, value);
      this.record.maxHp = values.recordFields.get(0x58)!;
      this.record.maxBullet = values.recordFields.get(0x38)!;
      // Original433466 writes these same bound OdlPlayer fields before notifications.
      if (role?.record?.numericFields) {
        role.record.numericFields.set(0x38, this.record.maxBullet | 0);
        role.record.numericFields.set(0x58, this.record.maxHp | 0);
      }
    };
    const notify = (index: 9 | 10 | 13 | 5): void => {
      markRolePropertyDirty(this.propertyDirty, index);
      this.notified(index, this);
    };
    const result = recomputeRoleAttributes({...input, base: input.base!, equipment: input.equipment!,
      tank: input.tank!, pet: input.pet!, skills: input.skills!, items: input.items!}, {
      setMovement: (selector, value, values) => {
        publish(values);
        setRoleMovementProperty(this.record, selector, value, notify);
      },
      notify: (index, values) => {publish(values); notify(index);},
      clearDirty: () => {
        this.dirty = false;
        if (role) role.dirty = false;
      },
    });
    publish(result.state);
    return result.completed;
  }
}
