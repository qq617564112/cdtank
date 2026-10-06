import type {ResInventory} from '../../../shared/protocols/PtlInventory';
import {classifyItemId} from '../../../shared/combat/item-hotkeys';

export interface AmmoSlotSnapshot {
  slot: number;
  itemTableId: number;
  quantity: number;
}

export type CycleDirection = 1 | -1;

/** Ordinary weapon cycle candidates: the default slot1 plus this round's
 * confirmed class3 ammo slots2–4 with positive quantity. Ground traps and
 * other placeable inventory records are never treated as ammo. */
export function weaponCandidateSlots(ammoSlots: readonly AmmoSlotSnapshot[]): number[] {
  const slots = [1];
  for (const ammo of ammoSlots) {
    if (ammo.slot < 2 || ammo.slot > 4 || (ammo.quantity >>> 0) === 0
        || classifyItemId(ammo.itemTableId) !== 3) continue;
    slots.push(ammo.slot);
  }
  return slots;
}

/** Confirmed item cycle candidates: hotkey indices3–6 (Battle slots5–8) whose
 * bound instance exists with positive owned and this-round quantity. */
export function itemCandidateSlots(inventory: ResInventory | undefined): number[] {
  if (!inventory) return [];
  const slots: number[] = [];
  for (let index = 3; index <= 6; index++) {
    const instanceId = inventory.hotkeys[index] >>> 0;
    if (!instanceId) continue;
    const record = inventory.records.find(value => (value.instanceId >>> 0) === instanceId);
    if (!record || (record.ownedQuantity >>> 0) === 0 || (record.battleQuantity >>> 0) === 0) continue;
    slots.push(index + 2);
  }
  return slots;
}

/** Step along ascending candidate slot numbers and wrap at either end. */
export function stepCandidate(slots: readonly number[], current: number | undefined,
  direction: CycleDirection): number | undefined {
  if (!slots.length) return undefined;
  if (current === undefined || !slots.includes(current)) {
    return direction > 0 ? slots[0] : slots[slots.length - 1];
  }
  const index = slots.indexOf(current);
  return slots[(index + direction + slots.length) % slots.length];
}

/** Transient weapon-cycle intent. Advanced by each accepted keydown so rapid
 * presses walk the input order without a pending/acknowledgement layer. The
 * baseline follows the server-confirmed ammo slot whenever that authority value
 * changes; lifecycle resets clear it outright. */
export class WeaponCycleSelection {
  private desired?: number;
  private server?: number;

  sync(selectedAmmoSlot: number | undefined): void {
    if (selectedAmmoSlot === this.server) return;
    this.server = selectedAmmoSlot;
    this.desired = selectedAmmoSlot === 2 || selectedAmmoSlot === 3 || selectedAmmoSlot === 4
      ? selectedAmmoSlot : 1;
  }

  reset(): void {this.desired = undefined; this.server = undefined;}

  next(slots: readonly number[], direction: CycleDirection): number | undefined {
    const next = stepCandidate(slots, this.desired, direction);
    if (next !== undefined) this.desired = next;
    return next;
  }
}
