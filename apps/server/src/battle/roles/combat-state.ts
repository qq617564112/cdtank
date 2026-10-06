import {setRoleHp, type RoleHealthRecord} from './health';
import {createRoleRecordNumericDefaults} from './record-defaults';

export interface RoleRecordState {
  status: 0 | 1 | 2 | 3;
  flags: Uint8Array;
  arrays: Map<number, Int32Array>;
  /** Absent for externally supplied incomplete records; no synthetic defaults on receipt. */
  numericFields?: Map<number, number>;
}

/** Original role fields +0x2a0, +0x2b4, +0x304, +0x308 and +0x9c. */
export class RoleCombatState {
  dirty = true;
  flag8Seconds = 0;
  specialFlag12 = 0;
  nextAvailableSeconds = 0;
  reloadStartedAt = 0;
  reloadDuration = 0;
  reloadSource: 'original-normal' | 'rebuilt' = 'rebuilt';
  /** Actual role float writes from recompute/notifications; absent fields stay absent. */
  readonly roleFloatFields = new Map<number, number>();
  activeActionId = 0;
  trapPermission = 1;
  trapCountdown = 3;
  /** Original41d7a6/41d76e initialize role+24; getter9 reads this signed counter. */
  recomputeCounter = 0;

  constructor(readonly record: RoleRecordState | undefined,
              private readonly notify: (index: number) => void = () => {}) {}

  /** Original43293d returns zero when the role record is absent. */
  get status(): number {return this.record?.status ?? 0;}

  /** Publish the original raw HP notification before its signed clamp. */
  setHealth(record: RoleHealthRecord, value: number): boolean {
    const fields = this.record?.numericFields;
    if (!fields) return false;
    fields.set(0x58, record.maxHp | 0);
    const accepted = setRoleHp(record, value, index => {
      fields.set(0x54, record.hp);
      this.notify(index);
    });
    fields.set(0x54, record.hp);
    return accepted;
  }

  /** Original432528 selector11: write slot, notify6, then clear role+308. */
  setSelectedAmmoSlot(value: number): boolean {
    if (!this.record?.numericFields) return false;
    this.record.numericFields.set(0x3c, value >>> 0);
    this.notify(6);
    this.specialFlag12 = 0;
    return true;
  }

  /** Original432349 selector11 reads m_iCurrentBulletId. */
  get selectedAmmoSlot(): number {return (this.record?.numericFields?.get(0x3c) ?? 0) >>> 0;}

  /** Original432528 selector12: write confirmed table ID and notify7. */
  setCurrentAmmoTableId(value: number): boolean {
    if (!this.record?.numericFields) return false;
    this.record.numericFields.set(0x40, value >>> 0);
    this.notify(7);
    return true;
  }

  /** Original432349 selector12 reads m_iNowBulletTableId. */
  get currentAmmoTableId(): number {return (this.record?.numericFields?.get(0x40) ?? 0) >>> 0;}

  /** Original432528 selector4 → record+44, notify8, with no clamp or dirty change. */
  setBulletCount(value: number): boolean {
    if (!this.record?.numericFields) return false;
    this.record.numericFields.set(0x44, value >>> 0);
    this.notify(8);
    return true;
  }

  /** Original432349 selector4 returns all32 bits; the reload branch compares exactly1. */
  get bulletCount(): number {return this.record?.numericFields?.get(0x44) ?? 0;}

  /** Original432349 selector24 → record+38 (m_iMaxBullet). */
  get maxBulletCount(): number {return (this.record?.numericFields?.get(0x38) ?? 0) >>> 0;}

  /** Recompute reads scalar copied skill/hat/balloon and table-ID part slots. */
  attributeSourceFields(): ReadonlyMap<number, number> | undefined {
    if (!this.record?.numericFields) return undefined;
    const fields = new Map(this.record.numericFields);
    fields.set(0x90, this.record.status);
    const parts = this.record.arrays.get(2);
    if (parts) for (let slot = 0; slot < 5; slot++) fields.set(0xbc + slot * 4, parts[slot] | 0);
    return fields;
  }

  /** Original43210e; compare the subtraction before rounding its stored field. */
  advanceTimers(argument: number): void {
    const delta = Math.fround(argument);
    if (this.flag8Seconds > 0) {
      const remaining = this.flag8Seconds - delta;
      this.flag8Seconds = Math.fround(remaining);
      if (remaining < 0) {
        this.flag8Seconds = 0;
        this.setFlag(8, 0);
      }
    }
    if ((this.trapPermission & 255) === 0 && this.trapCountdown > 0) {
      const remaining = this.trapCountdown - delta;
      this.trapCountdown = Math.fround(remaining);
      if (remaining <= 0) {
        this.trapCountdown = 3;
        this.trapPermission = 1;
      }
    }
  }

  /** Original getter returns a raw byte for12, a nonzero boolean for others. */
  getFlag(index: number): number {
    if (index === 12) return this.specialFlag12;
    return this.record && this.record.flags[index] !== 0 ? 1 : 0;
  }

  /** Original0x431dbf: nonzero increments a byte; zero clears the whole byte. */
  setFlag(index: number, value: number | boolean): void {
    const byte = Number(value) & 255;
    if (index === 12) {
      this.specialFlag12 = byte;
      return;
    }
    const record = this.record!;
    record.flags[index] = byte ? (record.flags[index] + 1) & 255 : 0;
    if (index === 8 && record.flags[8] !== 0) this.flag8Seconds = .5;
    this.notify(33);
  }

  /** Rebuilt trap producer writes the original uint8 flag9 array and notification33. */
  writeMovePermissionCount(count: number): void {
    if (!this.record) return;
    this.record.flags[9] = count & 255;
    this.notify(33);
  }

  /** Rebuilt fruit-jam producer writes the original uint8 turn-permission byte. */
  writeTurnPermissionCount(count: number): void {
    if (!this.record) return;
    this.record.flags[10] = count & 255;
    this.notify(33);
  }

  /** Rebuilt cork producer writes the original uint8 fire-permission byte. */
  writeFirePermissionCount(count: number): void {
    if (!this.record) return;
    this.record.flags[11] = count & 255;
    this.notify(33);
  }

  /** Original0x432826 copies slots and notifies before setting dirty. */
  setArray(index: number, values: readonly number[]): boolean {
    const count = index === 0 ? 7 : index === 1 ? 3 : index === 2 ? 5 : index === 4 ? 16 : 0;
    if (!this.record || !count) return false;
    const destination = this.record.arrays.get(index)!;
    for (let slot = 0; slot < count; slot++) destination[slot] = values[slot] | 0;
    this.notify(index === 4 ? 31 : 28 + index);
    this.dirty = true;
    return true;
  }

  /** Original getter3; absent role record returns zero even when dirty is set. */
  needsRecompute(): boolean {
    return this.record !== undefined && this.dirty;
  }

  /** Original0x433cf4 completion notifies13 and5 before clearing dirty. */
  finishRecompute(): void {
    this.notify(13);
    this.notify(5);
    this.dirty = false;
  }

  /** Original0x431e22 returns an evicted ID only when all16 slots are full. */
  addSkill(skillId: number): number {
    if (!this.record) return 0;
    this.dirty = true;
    const slots = this.record.arrays.get(4)!;
    const id = skillId | 0;
    // Original scan advances after shifting, so adjacent duplicates can remain.
    for (let index = 0; index < 16; index++) {
      if (slots[index] === id) this.removeSkillAt(index);
    }
    const empty = slots.indexOf(0);
    if (empty !== -1) {
      slots[empty] = id;
      return 0;
    }
    const evicted = slots[0];
    for (let index = 0; index < 15; index++) slots[index] = slots[index + 1];
    slots[15] = id;
    this.notify(31);
    return evicted;
  }

  /** Original0x431ee5 always notifies31 when a record exists. */
  removeSkill(skillId: number): void {
    if (!this.record) return;
    this.dirty = true;
    const slots = this.record.arrays.get(4)!;
    for (let index = 0; index < 16; index++) {
      if (slots[index] === (skillId | 0)) this.removeSkillAt(index);
    }
    this.notify(31);
  }

  /** Original0x431f38 shifts following slots and clears slot15. */
  removeSkillAt(position: number): void {
    if (!this.record) return;
    this.dirty = true;
    const index = position | 0;
    if (index < 0) return;
    const slots = this.record.arrays.get(4)!;
    for (let slot = index; slot < 15; slot++) slots[slot] = slots[slot + 1];
    slots[15] = 0;
    this.notify(31);
  }

  /** Original0x432e2a/76/cc,0x432f50 lifecycle, dispatched by0x4259ae. */
  setStatus(status: 0 | 1 | 2 | 3): void {
    if (!this.record) return;
    if (status === 1) this.activeActionId = 0;
    this.record.status = status;
    // The original status3 path does not emit notification27.
    if (status !== 3) this.notify(27);
    if (status === 2) {
      this.record.flags.fill(0);
      this.notify(33);
    }
    for (const index of [9, 10, 11]) this.setFlag(index, status === 2);
    if (status === 2) {
      this.specialFlag12 = 0;
      this.nextAvailableSeconds = 0;
      this.reloadDuration = 0;
      this.reloadStartedAt = 0;
    }
    this.activeActionId = 0;
  }
}

export function createRoleCombatState(): RoleCombatState {
  return new RoleCombatState({status: 0, flags: new Uint8Array(16), numericFields: createRoleRecordNumericDefaults(), arrays: new Map([
    [0, new Int32Array(7)], [1, new Int32Array(3)],
    [2, new Int32Array(5)], [4, new Int32Array(16)],
  ])});
}
