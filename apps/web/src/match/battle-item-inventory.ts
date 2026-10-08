import type {InventoryWireRecord, ResInventory} from '../../../shared/protocols/PtlInventory';
import type {MsgRoomEvent} from '../../../shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {itemCandidateSlots} from './battle-shortcut-selection';

export interface BattleItemInventorySnapshot {
  inventory?: ResInventory;
  /** Server-confirmed ordinary ammo selection, normalized so slot1 is always a
   * valid value. Kept for existing HUD consumers; never a local prediction. */
  selectedWeaponSlot: number;
  /** Local cursor for the item shortcut bar's currently selected Battle slot
   * (5–8). This client's own choice only; never sent to or authoritative on the
   * server. The single owner is this store. */
  selectedItemSlot?: number;
}

function serverWeaponSlot(selectedAmmoSlot: number | undefined): number {
  return selectedAmmoSlot === 2 || selectedAmmoSlot === 3 || selectedAmmoSlot === 4
    ? selectedAmmoSlot : 1;
}

/** Confirmed room inventory; committed changes refresh authority, never predict stock. */
export class BattleItemInventory {
  private state: BattleItemInventorySnapshot = {selectedWeaponSlot: 1};
  private context?: {roomId: string; round: number; playerId: string};
  private revision = 0;
  private dirty = false;
  private loading = false;
  private readonly configuredItemSlots = new Map<number, number>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly read: () => Promise<ResInventory>) {}

  readonly getSnapshot = (): BattleItemInventorySnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };

  update(snapshot: MsgRoomSnapshot, playerId: string): void {
    if (snapshot.phase === 'WAITING') {this.clear(); return;}
    const round = snapshot.match?.round ?? 0;
    const selectedWeaponSlot = serverWeaponSlot(
      snapshot.players.find(player => player.id === playerId)?.selectedAmmoSlot);
    if (this.context?.roomId === snapshot.roomId && this.context.round === round
        && this.context.playerId === playerId) {
      if (selectedWeaponSlot !== this.state.selectedWeaponSlot) {
        this.publish({...this.state, selectedWeaponSlot});
      }
      return;
    }
    this.context = {roomId: snapshot.roomId, round, playerId};
    this.configuredItemSlots.clear();
    this.publish({selectedWeaponSlot});
    this.refresh();
  }

  event(event: MsgRoomEvent): void {
    if (event.roomId === this.context?.roomId && event.playerId === this.context.playerId
        && (event.type === 'itemUsed' || event.type === 'ammoConsumed'
          || event.type === 'inventoryChanged')) this.refresh();
  }

  clear(): void {
    if (!this.context && !this.state.inventory && this.state.selectedWeaponSlot === 1
        && this.state.selectedItemSlot === undefined) return;
    this.context = undefined;
    this.configuredItemSlots.clear();
    ++this.revision;
    this.dirty = false;
    this.publish({selectedWeaponSlot: 1});
  }

  /** Move the local item cursor to a Battle slot5–8; only configured item slots
   * are accepted. Exhausted bound records remain selected and reach the unified
   * quantity gate. Unbound or unknown slots are never written. Returns whether
   * it changed. */
  setSelectedItemSlot(slot: number): boolean {
    if (slot < 5 || slot > 8 || slot === this.state.selectedItemSlot) return false;
    if (!this.itemSlots().includes(slot)) return false;
    this.publish({...this.state, selectedItemSlot: slot});
    return true;
  }

  /** Configured item slots for the current round. A slot seen with a real record
   * stays configured after the server removes its last instance and clears the
   * authoritative hotkey, so the ordinary entry can still reject it with UI28
   * instead of treating it as never configured. */
  itemSlots(): number[] {
    const slots = itemCandidateSlots(this.state.inventory);
    for (const slot of this.configuredItemSlots.keys()) {
      if (!slots.includes(slot)) slots.push(slot);
    }
    slots.sort((left, right) => left - right);
    return slots;
  }

  /** Current confirmed record plus the local per-round configured identity. A
   * cleared slot has no record and is rejected by the unified quantity gate. */
  configuredItemSlot(slot: number): {record?: InventoryWireRecord; cleared: boolean} | undefined {
    if (slot < 5 || slot > 8) return undefined;
    const currentId = (this.state.inventory?.hotkeys[slot - 2] ?? 0) >>> 0;
    const rememberedId = this.configuredItemSlots.get(slot) ?? 0;
    const instanceId = currentId || rememberedId;
    if (!instanceId) return undefined;
    if (currentId) this.configuredItemSlots.set(slot, currentId);
    const record = currentId
      ? this.state.inventory?.records.find(value => (value.instanceId >>> 0) === instanceId) : undefined;
    return {record, cleared: currentId === 0};
  }

  /** Existing HUD entry: item slots move the local cursor, weapon slots keep the
   * server-confirmed authority value. */
  selectSlot(slot: number): void {
    if (slot >= 5 && slot <= 8) this.setSelectedItemSlot(slot);
  }

  /** Keep a still-configured cursor, otherwise fall back to the first configured
   * item slot or clear it when nothing is configured. */
  private resolveCursor(inventory: ResInventory | undefined, slot: number | undefined): number | undefined {
    for (let index = 3; index <= 6; index++) {
      const instanceId = (inventory?.hotkeys[index] ?? 0) >>> 0;
      if (!instanceId) continue;
      const record = inventory?.records.find(value => (value.instanceId >>> 0) === instanceId);
      if (record) this.configuredItemSlots.set(index + 2, instanceId);
    }
    const slots = this.itemSlots();
    if (slot !== undefined && slots.includes(slot)) return slot;
    return slots[0];
  }

  private publish(state: BattleItemInventorySnapshot): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private refresh(): void {
    ++this.revision;
    this.dirty = true;
    if (!this.loading) void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      while (this.context && this.dirty) {
        this.dirty = false;
        const revision = this.revision;
        try {
          const inventory = await this.read();
          if (this.context && revision === this.revision) {
            this.publish({inventory, selectedWeaponSlot: this.state.selectedWeaponSlot,
              selectedItemSlot: this.resolveCursor(inventory, this.state.selectedItemSlot)});
          }
        } catch {
          if (this.context && revision === this.revision) {
            this.publish({selectedWeaponSlot: this.state.selectedWeaponSlot,
              selectedItemSlot: this.resolveCursor(this.state.inventory, this.state.selectedItemSlot)});
          }
        }
      }
    } finally {this.loading = false;}
  }
}
