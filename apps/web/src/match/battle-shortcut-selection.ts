import {defaultAmmoId} from '../../../shared/content/catalog';
import type {ResInventory} from '../../../shared/protocols/PtlInventory';
import {classifyItemId} from '../../../shared/combat/item-hotkeys';

export interface AmmoSlotSnapshot {
  slot: number;
  itemTableId: number;
  quantity: number;
}

/** Battle item slots5–8 whose bound instance still exists. Exhausted configured
 * records stay candidates so the unified4cb2f5 entry can play UI28 and reject. */
export function itemCandidateSlots(inventory: ResInventory | undefined): number[] {
  if (!inventory) return [];
  const slots: number[] = [];
  for (let index = 3; index <= 6; index++) {
    const instanceId = inventory.hotkeys[index] >>> 0;
    if (!instanceId) continue;
    const record = inventory.records.find(value => (value.instanceId >>> 0) === instanceId);
    if (!record) continue;
    slots.push(index + 2);
  }
  return slots;
}

/** Ordinary weapon cycle candidates: the default slot1, this round's confirmed
 * class3 ammo slots2–4, and confirmed class4 trap records at those slots.
 * Configured records stay candidates after exhaustion; the unified entry owns
 * the quantity gate. Traps come from the client's confirmed inventory hotkeys
 * because the server ammo snapshot intentionally carries only class3. */
export function weaponCandidateSlots(ammoSlots: readonly AmmoSlotSnapshot[],
  inventory: ResInventory | undefined): number[] {
  const slots = [1];
  for (const ammo of ammoSlots) {
    if (ammo.slot < 2 || ammo.slot > 4 || classifyItemId(ammo.itemTableId) !== 3) continue;
    slots.push(ammo.slot);
  }
  for (let index = 0; index <= 2; index++) {
    const slot = index + 2;
    if (slots.includes(slot)) continue;
    const instanceId = (inventory?.hotkeys[index] ?? 0) >>> 0;
    if (!instanceId) continue;
    const record = inventory?.records.find(value => (value.instanceId >>> 0) === instanceId);
    if (!record) continue;
    if (classifyItemId(record.itemTableId) !== 4) continue;
    slots.push(slot);
  }
  slots.sort((left, right) => left - right);
  return slots;
}

/** Step along ascending candidate slot numbers; the original endpoint keeps the
 * current selection instead of wrapping to the opposite end. */
export function stepCandidate(slots: readonly number[], current: number | undefined,
  direction: 1 | -1): number | undefined {
  if (!slots.length) return undefined;
  if (current === undefined || !slots.includes(current)) {
    return direction > 0 ? slots[0] : slots[slots.length - 1];
  }
  const index = slots.indexOf(current);
  const next = index + direction;
  return next < 0 || next >= slots.length ? current : slots[next];
}

/** A cycle choice with the confirmed record used to resolve its slot request. */
interface WeaponCycleChoice {
  slot: number;
  kind: 'default' | 'ammo' | 'trap';
  itemTableId: number;
  quantity: number;
  instanceId: number;
}

/** Weapon navigation is separate from server-confirmed ammunition. A trap
 * cursor stays at its bound usable slot across ammunition acknowledgements
 * and consumption. Pending ammunition choices settle in request order, while
 * direct picks, rejected requests and lifecycle changes reset navigation. */
export class WeaponCycleSelection {
  private desired?: number;
  private server = 1;
  private pending: WeaponCycleChoice[] = [];
  private trapCursor?: WeaponCycleChoice;
  private ammo: readonly AmmoSlotSnapshot[] = [];
  private inventory?: ResInventory;

  /** Reconcile ammunition requests and the independent trap navigation cursor
   * against their respective confirmed records. */
  sync(selectedAmmoSlot: number | undefined, ammoSlots: readonly AmmoSlotSnapshot[],
    inventory: ResInventory | undefined): void {
    const server = selectedAmmoSlot === 2 || selectedAmmoSlot === 3 || selectedAmmoSlot === 4
      ? selectedAmmoSlot : 1;
    if (server !== this.server) {
      this.server = server;
      const confirmed = this.pending.findIndex(request => request.slot === server);
      if (confirmed >= 0) this.pending = this.pending.slice(confirmed + 1);
      else this.pending = [];
    }
    if (this.pending.some(request => !this.stillValid(request, ammoSlots, inventory))) this.pending = [];
    if (this.trapCursor && !this.stillValid(this.trapCursor, ammoSlots, inventory)) {
      this.trapCursor = undefined;
    }
    this.ammo = ammoSlots;
    this.inventory = inventory;
    this.desired = this.trapCursor?.slot
      ?? (this.pending.length ? this.pending[this.pending.length - 1].slot : server);
  }

  /** A rejected ordinary weapon request (business rejection or send failure)
   * drops its intent and returns to the real confirmed selection; the authority
   * value itself is never set here. */
  reject(): void {
    this.pending = [];
    this.trapCursor = undefined;
    this.desired = this.server;
  }

  /** Drop cycling intent for a direct number/HUD pick and return to the current
   * confirmed baseline; the pick itself is confirmed by the server, not here. */
  returnToConfirmed(): void {
    this.reject();
  }

  reset(): void {
    this.desired = undefined;
    this.server = 1;
    this.pending = [];
    this.trapCursor = undefined;
    this.ammo = [];
    this.inventory = undefined;
  }

  next(slots: readonly number[], direction: 1 | -1,
    inventory: ResInventory | undefined): number | undefined {
    if ((this.pending.length || this.trapCursor)
        && (this.desired === undefined || !slots.includes(this.desired))) {
      this.reject();
    }
    const next = stepCandidate(slots, this.desired, direction);
    if (next === undefined) return undefined;
    this.desired = next;
    const choice = this.record(next, inventory);
    if (choice.kind === 'trap') {
      this.trapCursor = choice;
    } else {
      this.trapCursor = undefined;
      // The current confirmed slot needs no pending acknowledgement unless an
      // older selection request can still change the server's selection.
      if (next !== this.server || this.pending.length) this.pending.push(choice);
    }
    return next;
  }

  /** Real confirmed ammo or trap record for the requested slot at request time;
   * slot1 is the always-available default. */
  private record(slot: number, inventory: ResInventory | undefined): WeaponCycleChoice {
    if (slot === 1) return {slot: 1, kind: 'default', itemTableId: defaultAmmoId(), quantity: 1, instanceId: 0};
    const ammo = this.ammo.find(value => value.slot === slot);
    if (ammo) return {slot, kind: 'ammo', itemTableId: ammo.itemTableId, quantity: ammo.quantity, instanceId: 0};
    const resolved = inventory ?? this.inventory;
    const instanceId = (resolved?.hotkeys[slot - 2] ?? 0) >>> 0;
    const record = instanceId
      ? resolved?.records.find(value => (value.instanceId >>> 0) === instanceId) : undefined;
    return {slot, kind: 'trap', itemTableId: record?.itemTableId ?? 0,
      quantity: record?.battleQuantity ?? 0, instanceId};
  }

  /** Ammo requests retain their original count; a trap cursor retains its
   * binding while the configured record remains. Exhausted records stay
   * navigable and are rejected by the ordinary quantity gate. */
  private stillValid(request: WeaponCycleChoice, ammoSlots: readonly AmmoSlotSnapshot[],
    inventory: ResInventory | undefined): boolean {
    if (request.kind === 'default') return true;
    if (request.kind === 'ammo') {
      const ammo = ammoSlots.find(value => value.slot === request.slot);
      if (ammo === undefined) return false;
      if (classifyItemId(ammo.itemTableId) !== 3) return false;
      return request.itemTableId === ammo.itemTableId && request.quantity === ammo.quantity;
    }
    const instanceId = (inventory?.hotkeys[request.slot - 2] ?? 0) >>> 0;
    if (!instanceId || instanceId !== request.instanceId) return false;
    const record = inventory?.records.find(value => (value.instanceId >>> 0) === instanceId);
    if (!record) return false;
    return classifyItemId(record.itemTableId) === 4;
  }
}
