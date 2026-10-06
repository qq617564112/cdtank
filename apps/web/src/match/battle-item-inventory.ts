import type {ResInventory} from '../../../shared/protocols/PtlInventory';
import type {MsgRoomEvent} from '../../../shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {itemCandidateSlots} from './battle-shortcut-selection';

export interface BattleItemInventorySnapshot {
  inventory?: ResInventory;
  /** Local cursor for the item shortcut bar's currently selected Battle slot
   * (5–8). It reflects this client's own choice only and is never sent to or
   * authoritative on the server. */
  selectedItemSlot?: number;
}

/** Confirmed room inventory; committed changes refresh authority, never predict stock. */
export class BattleItemInventory {
  private state: BattleItemInventorySnapshot = {};
  private context?: {roomId: string; round: number; playerId: string};
  private revision = 0;
  private dirty = false;
  private loading = false;
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
    if (this.context?.roomId === snapshot.roomId && this.context.round === round
        && this.context.playerId === playerId) return;
    this.context = {roomId: snapshot.roomId, round, playerId};
    this.publish({});
    this.refresh();
  }

  event(event: MsgRoomEvent): void {
    if (event.roomId === this.context?.roomId && event.playerId === this.context.playerId
        && (event.type === 'itemUsed' || event.type === 'ammoConsumed'
          || event.type === 'inventoryChanged')) this.refresh();
  }

  clear(): void {
    if (!this.context && !this.state.inventory) return;
    this.context = undefined;
    ++this.revision;
    this.dirty = false;
    this.publish({});
  }

  /** Move the local item cursor to a Battle slot5–8; only legal item slots are
   * accepted. Returns whether the cursor changed. */
  setSelectedItemSlot(slot: number): boolean {
    if (slot < 5 || slot > 8 || slot === this.state.selectedItemSlot) return false;
    this.publish({...this.state, selectedItemSlot: slot});
    return true;
  }

  /** Keep a still-available cursor, otherwise fall back to the first available
   * item slot or clear it when nothing is usable. */
  private resolveCursor(inventory: ResInventory | undefined, slot: number | undefined): number | undefined {
    const slots = itemCandidateSlots(inventory);
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
            this.publish({inventory, selectedItemSlot: this.resolveCursor(inventory, this.state.selectedItemSlot)});
          }
        } catch {
          if (this.context && revision === this.revision) {
            this.publish({selectedItemSlot: this.resolveCursor(this.state.inventory, this.state.selectedItemSlot)});
          }
        }
      }
    } finally {this.loading = false;}
  }
}
