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

/** An accepted cycle keypress that the server confirmation has not caught up
 * with yet, remembered with the real ammo record that made it meaningful. */
interface PendingAmmoRequest {
  slot: number;
  itemTableId: number;
  quantity: number;
}

/** Transient weapon-cycle intent for useItem slots1–4. Each accepted keydown
 * walks the input order and records its requested slot together with the real
 * confirmed ammo record behind it. A confirmation only advances the cursor once
 * it catches up with that in-order list, so an older acknowledgement never drags
 * a still-newer keypress back. An ordinary `itemRejected`, a send failure, an
 * outstanding slot whose confirmed quantity or table changed, a vanished
 * candidate, a direct pick, or any lifecycle reset returns to the current
 * confirmed baseline. HUD still reads the server value only. */
export class WeaponCycleSelection {
  private desired?: number;
  private server = 1;
  private pending: PendingAmmoRequest[] = [];
  private ammo: readonly AmmoSlotSnapshot[] = [];

  /** Adopt the confirmed authority value and reconcile the request list against
   * the current confirmed ammo state. Requests the confirmation has passed are
   * settled; if any outstanding request's real slot disappeared or its quantity
   * or table moved, the whole intent returns to the confirmed source. */
  sync(selectedAmmoSlot: number | undefined, ammoSlots: readonly AmmoSlotSnapshot[]): void {
    const server = selectedAmmoSlot === 2 || selectedAmmoSlot === 3 || selectedAmmoSlot === 4
      ? selectedAmmoSlot : 1;
    if (server !== this.server) {
      this.server = server;
      const confirmed = this.pending.findIndex(request => request.slot === server);
      if (confirmed >= 0) this.pending = this.pending.slice(confirmed + 1);
      else this.pending = [];
    }
    if (this.pending.some(request => !this.stillValid(request, ammoSlots))) this.pending = [];
    this.ammo = ammoSlots;
    this.desired = this.pending.length ? this.pending[this.pending.length - 1].slot : server;
  }

  /** A rejected ordinary weapon request (business rejection or send failure)
   * drops its intent and returns to the real confirmed selection; the authority
   * value itself is never set here. */
  reject(): void {
    this.pending = [];
    this.desired = this.server;
  }

  /** Drop cycling intent for a direct number/HUD pick and return to the current
   * confirmed baseline; the pick itself is confirmed by the server, not here. */
  returnToConfirmed(): void {
    this.reject();
  }

  reset(): void {this.desired = undefined; this.server = 1; this.pending = []; this.ammo = [];}

  next(slots: readonly number[], direction: CycleDirection): number | undefined {
    if (this.pending.length && (this.desired === undefined || !slots.includes(this.desired))) {
      this.reject();
    }
    const next = stepCandidate(slots, this.desired, direction);
    if (next === undefined) return undefined;
    this.desired = next;
    this.pending.push(this.record(next));
    return next;
  }

  /** Real confirmed ammo record for the requested slot at request time; slot1 is
   * the always-available default. */
  private record(slot: number): PendingAmmoRequest {
    if (slot === 1) return {slot: 1, itemTableId: 2001, quantity: 1};
    const ammo = this.ammo.find(value => value.slot === slot);
    return {slot, itemTableId: ammo?.itemTableId ?? 0, quantity: ammo?.quantity ?? 0};
  }

  /** A request stays outstanding while its confirmed record still offers the
   * same usable slot with the same table and quantity. */
  private stillValid(request: PendingAmmoRequest, ammoSlots: readonly AmmoSlotSnapshot[]): boolean {
    if (request.slot === 1) return true;
    const ammo = ammoSlots.find(value => value.slot === request.slot);
    if (ammo === undefined) return false;
    if ((ammo.quantity >>> 0) === 0 || classifyItemId(ammo.itemTableId) !== 3) return false;
    return request.itemTableId === ammo.itemTableId && request.quantity === ammo.quantity;
  }
}
