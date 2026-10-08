import {defaultAmmoId, gameContent} from '../../../../shared/content/catalog';
import {randomUUID} from 'node:crypto';
import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {isTreasureItem} from '../../../../shared/combat/treasure-items';
import {combatItems} from '../catalog';
import {selectDropVisual} from './drop-item-catalog';

export const GROUND_PICKUP_RADIUS = 40;

export interface GroundItemState {
  id: string;
  itemTableId: number;
  quantity: number;
  modelId: string;
  texture: 'A' | 'B';
  soundId: string;
  effectId: string;
  x: number;
  y: number;
  z: number;
  source: 'BREACH' | 'DISCARD';
  ownerId?: string;
  createdAt: number;
}

export interface GroundItemEventFields {
  groundItemDropped?: GroundItemState;
  groundItemPickedUp?: {id: string; playerId: string; itemTableId: number; quantity: number};
  groundItemRemoved?: {id: string};
}

export type GroundItemRoomEvent = MsgRoomEvent & GroundItemEventFields;

export interface GroundItemRoomPlayer {
  id: string;
  cpu?: unknown;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  /** PlayerState.combat.record arrays are Int32Array in the live domain. */
  inventory: InventoryWireRecord[];
  combat: {
    status: number;
    record?: {arrays: ReadonlyMap<number, Int32Array>};
    setArray?: (index: number, values: readonly number[]) => boolean;
  };
}

export interface GroundItemRoom {
  roomId: string;
  mode: number;
  round: number;
  phase: string;
  groundItems: GroundItemState[];
  players: ReadonlyMap<string, GroundItemRoomPlayer>;
}

export interface BreachDropSource {
  id: string;
  hp: number;
  destroyedAt?: number;
  x: number;
  y: number;
  z: number;
}

export interface DiscardGroundItemRequest {
  roomId: string;
  round: number;
  groundId: string;
  playerId: string;
  instanceId: number;
  itemTableId: number;
  expectedQuantity: number;
  quantity: 1;
}

export interface AcquireGroundItemRequest {
  roomId: string;
  round: number;
  groundId: string;
  playerId: string;
  itemTableId: number;
  quantity: number;
  source: GroundItemState['source'];
  ownerId?: string;
}

export interface GroundItemAcquireResult {
  record: InventoryWireRecord;
  /** Other live participants of the same account refreshed by the bridge. */
  refreshPlayerIds?: readonly string[];
}

export type DiscardGroundItem = (
  request: DiscardGroundItemRequest
) => InventoryWireRecord | undefined;

export type AcquireGroundItem = (
  request: AcquireGroundItemRequest
) => GroundItemAcquireResult | undefined;

export interface AcquireDiscardCallbacks {
  acquire?: AcquireGroundItem;
  discard?: DiscardGroundItem;
  /** Successfully consumed quantity for this player/item in the current round. */
  roundUse?: (playerId: string, itemTableId: number) => number;
  /** Real selected pet kind from the authoritative role/CPU source; absent means none. */
  petType?: (playerId: string) => number | undefined;
  /** Contact rejection before acquiring inventory or applying pickup healing. */
  pickupRejection?: (playerId: string, ground: GroundItemState) => string | undefined;
  /** Called only for the participant whose committed acquisition removed this entity. */
  pickupSucceeded?: (playerId: string, ground: GroundItemState, events: MsgRoomEvent[]) => void;
}

const RUN_ID = randomUUID();

const groundCounters = new Map<string, number>();
const breachDropKeys = new Map<string, Set<string>>();
interface PickupRejection {playerId: string; groundId: string; message: string;}
const pickupRejections = new Map<string, Map<string, PickupRejection>>();

function roundKey(room: Pick<GroundItemRoom, 'roomId' | 'round'>): string {
  return `${room.roomId}:${room.round}`;
}

function nextGroundItemId(room: GroundItemRoom): string {
  const key = roundKey(room);
  const counter = (groundCounters.get(key) ?? 0) + 1;
  groundCounters.set(key, counter);
  return `${RUN_ID}:${room.roomId}:${room.round}:G${counter}`;
}

function pushGroundItemEvent(normalEvents: MsgRoomEvent[], event: GroundItemRoomEvent): void {
  normalEvents.push(event);
}

function rejectDiscard(normalEvents: MsgRoomEvent[], player: GroundItemRoomPlayer,
    roomId: string, message: string): false {
  normalEvents.push({roomId, type: 'itemRejected', message, playerId: player.id,
    targetId: '', value: 0, x: player.x, y: player.y, z: player.z});
  return false;
}

/** Notify once per reason while this player remains in contact with this drop. */
function rejectPickup(room: GroundItemRoom, player: GroundItemRoomPlayer, ground: GroundItemState,
    normalEvents: MsgRoomEvent[], message: string): false {
  if (player.cpu) return false;
  const scope = roundKey(room);
  let rejected = pickupRejections.get(scope);
  if (!rejected) {rejected = new Map(); pickupRejections.set(scope, rejected);}
  const key = `${player.id}:${ground.id}`;
  if (rejected.get(key)?.message === message) return false;
  rejected.set(key, {playerId: player.id, groundId: ground.id, message});
  normalEvents.push({roomId: room.roomId, type: 'itemRejected', message, playerId: player.id,
    targetId: ground.id, value: 0, x: ground.x, y: ground.y, z: ground.z});
  return false;
}

function battleUseMax(itemTableId: number): number {
  return Math.max(0, combatItems.get(itemTableId)?.battleUseMax ?? 0);
}

/** Adopted usable-count policy shared with initializeBattleQuantities: the two Func20
 * treasures (source BattleUseMax0) expose the real remaining owned count; others keep
 * max(0, BattleUseMax - roundUse). */
function remainingBattleQuantity(itemTableId: number, owned: number, used: number): number {
  if (isTreasureItem(itemTableId)) return owned >>> 0;
  const cap = battleUseMax(itemTableId);
  return Math.max(0, Math.min(owned >>> 0, Math.max(0, cap - used)));
}

function hotkeyContains(player: GroundItemRoomPlayer, instanceId: number): boolean {
  const hotkeys = player.combat.record?.arrays.get(0);
  if (!hotkeys) return false;
  const id = instanceId >>> 0;
  for (let index = 0; index < hotkeys.length; index++) {
    if ((hotkeys[index] >>> 0) === id) return true;
  }
  return false;
}

function clearRemovedHotkeys(player: GroundItemRoomPlayer, instanceId: number): void {
  const hotkeys = player.combat.record?.arrays.get(0);
  if (!hotkeys) return;
  const id = instanceId >>> 0;
  for (let index = 0; index < hotkeys.length; index++) {
    if ((hotkeys[index] >>> 0) === id) hotkeys[index] = 0;
  }
}

function assignPickupHotkey(player: GroundItemRoomPlayer, instanceId: number, itemTableId: number): boolean {
  const item = combatItems.get(itemTableId >>> 0);
  const hotkeys = player.combat.record?.arrays.get(0);
  if (!item || !hotkeys) return false;
  const id = instanceId >>> 0;
  if (!id) return false;
  for (let slot = 0; slot < hotkeys.length; slot++) {
    if ((hotkeys[slot] >>> 0) === id) return true;
  }
  const weaponSlot = item.kind === 'ammo' || item.kind === 'trap';
  const consumableSlot = item.kind === 'item';
  if (!weaponSlot && !consumableSlot) return false;
  const first = weaponSlot ? 0 : 3;
  const last = weaponSlot ? 2 : 6;
  const next = Array.from({length: 7}, (_, slot) => hotkeys[slot] ?? 0);
  for (let slot = first; slot <= last; slot++) {
    if ((next[slot] >>> 0) !== 0) continue;
    next[slot] = id;
    return player.combat.setArray?.(0, next) ?? false;
  }
  return false;
}

function replaceInventoryRecord(player: GroundItemRoomPlayer, record: InventoryWireRecord): void {
  const index = player.inventory.findIndex(value =>
    (value.instanceId >>> 0) === (record.instanceId >>> 0));
  if (record.ownedQuantity >>> 0) {
    if (index >= 0) player.inventory[index] = record;
    else player.inventory.push(record);
    return;
  }
  if (index >= 0) player.inventory.splice(index, 1);
  clearRemovedHotkeys(player, record.instanceId);
}

function applyDiscardedRecord(player: GroundItemRoomPlayer, record: InventoryWireRecord,
    callbacks: AcquireDiscardCallbacks): void {
  const owned = record.ownedQuantity >>> 0;
  const assigned = hotkeyContains(player, record.instanceId);
  const used = Math.max(0, callbacks.roundUse?.(player.id, record.itemTableId) ?? 0);
  const next = {...record, ownedQuantity: owned,
    battleQuantity: assigned ? remainingBattleQuantity(record.itemTableId, owned, used) : 0};
  replaceInventoryRecord(player, next);
}

function acquiredBattleQuantity(player: GroundItemRoomPlayer, instanceId: number,
    itemTableId: number, newOwned: number, used: number): number {
  if (!hotkeyContains(player, instanceId)) return 0;
  return remainingBattleQuantity(itemTableId, newOwned, used);
}

function applyAcquiredRecord(player: GroundItemRoomPlayer, record: InventoryWireRecord,
    itemTableId: number, callbacks: AcquireDiscardCallbacks, assignHotkey = false): void {
  const owned = record.ownedQuantity >>> 0;
  if (assignHotkey) assignPickupHotkey(player, record.instanceId, itemTableId);
  const used = Math.max(0, callbacks.roundUse?.(player.id, itemTableId) ?? 0);
  const next = {...record, itemTableId, ownedQuantity: owned,
    battleQuantity: acquiredBattleQuantity(player, record.instanceId, itemTableId, owned, used)};
  replaceInventoryRecord(player, next);
}

/** Apply one committed canonical inventory update without resetting unrelated combat state. */
export function reconcileGroundItemInventory(player: GroundItemRoomPlayer,
    record: InventoryWireRecord, callbacks: AcquireDiscardCallbacks): void {
  applyAcquiredRecord(player, record, record.itemTableId >>> 0, callbacks, false);
}

function firstUnusedInstanceId(player: GroundItemRoomPlayer): number | undefined {
  const used = new Set(player.inventory.map(record => record.instanceId >>> 0));
  for (let id = 1; id <= 0xffffffff; id++) {
    if (!used.has(id)) return id;
  }
  return undefined;
}

function localRecord(itemTableId: number, quantity: number): InventoryWireRecord {
  return {
    instanceId: 0,
    itemTableId,
    ownedQuantity: quantity,
    battleQuantity: 0,
    state: 0,
    field8: 0,
    float24Bits: 0,
    float28Bits: 0,
    float2cBits: 0,
  };
}

function acquireLocally(player: GroundItemRoomPlayer, ground: GroundItemState):
  InventoryWireRecord | undefined {
  const existing = player.inventory.find(record =>
    (record.itemTableId >>> 0) === (ground.itemTableId >>> 0) && (record.ownedQuantity >>> 0) > 0);
  if (existing) {
    return {...existing, ownedQuantity: (existing.ownedQuantity >>> 0) + (ground.quantity >>> 0)};
  }
  const instanceId = firstUnusedInstanceId(player);
  if (instanceId === undefined) return undefined;
  return {...localRecord(ground.itemTableId, ground.quantity), instanceId};
}

/**
 * One real Breach destruction creates at most one ground item. The source
 * placement, not the attacker, owns the position. A single uniform roll both
 * gates at the configured chance and selects one equally likely pool entry.
 */
export function createBreachDrop(room: GroundItemRoom, source: BreachDropSource,
    ownerId: string, now: number, random: () => number,
    normalEvents: MsgRoomEvent[]): GroundItemState | undefined {
  if (![1, 2, 3, 4, 5].includes(room.mode) || room.phase !== 'PLAYING' || source.hp > 0
      || !Number.isFinite(source.destroyedAt)
      || ![source.x, source.y, source.z].every(Number.isFinite)) return undefined;
  const key = roundKey(room);
  const trigger = `${source.id}:${source.destroyedAt}`;
  let triggers = breachDropKeys.get(key);
  if (!triggers) {
    triggers = new Set();
    breachDropKeys.set(key, triggers);
  }
  if (triggers.has(trigger)) return undefined;
  triggers.add(trigger);

  const roll = random();
  const rules = gameContent().rules.groundDrops;
  const chance = rules.chance;
  const quantity = rules.quantity >>> 0;
  if (!(chance > 0 && chance <= 1) || !(roll >= 0 && roll < 1) || roll >= chance || !quantity) return undefined;
  const pool = [...combatItems.values()].filter(item => item.runtime.values.breachDropOrder > 0)
    .sort((a, b) => a.runtime.values.breachDropOrder - b.runtime.values.breachDropOrder).map(item => item.itemTableId);
  if (!pool.length) return undefined;
  const poolIndex = Math.min(pool.length - 1, Math.floor(roll / chance * pool.length));
  const itemTableId = pool[poolIndex];
  const visual = selectDropVisual(itemTableId, quantity);
  if (!visual) return undefined;
  const state: GroundItemState = {
    id: nextGroundItemId(room),
    itemTableId,
    quantity,
    ...visual,
    x: source.x,
    y: source.y,
    z: source.z,
    source: 'BREACH',
    ownerId: ownerId || undefined,
    createdAt: now,
  };
  room.groundItems.push(state);
  pushGroundItemEvent(normalEvents, {
    roomId: room.roomId,
    type: 'groundItemDropped',
    message: '',
    playerId: ownerId,
    targetId: state.id,
    value: state.quantity,
    x: state.x,
    y: state.y,
    z: state.z,
    groundItemDropped: {...state},
  });
  return state;
}

/**
 * Explicit ordinary action 100. Human persistence must return the
 * authoritative post-CAS record before the ground entity exists.
 */
export function discardToGround(room: GroundItemRoom, player: GroundItemRoomPlayer,
    instanceId: number, now: number, callbacks: AcquireDiscardCallbacks,
    normalEvents: MsgRoomEvent[]): boolean {
  if (room.phase !== 'PLAYING' || !player.alive || player.combat.status !== 2) {
    return rejectDiscard(normalEvents, player, room.roomId, '当前无法丢弃物品');
  }
  const id = instanceId >>> 0;
  if (!id) return rejectDiscard(normalEvents, player, room.roomId, '库存实例无效');
  const item = player.inventory.find(record => (record.instanceId >>> 0) === id);
  if (!item) return rejectDiscard(normalEvents, player, room.roomId, '该实例不在当前库存');
  const itemTableId = item.itemTableId >>> 0;
  const category = classifyInventoryCategory(itemTableId);
  if (itemTableId === defaultAmmoId() || category < 1 || category > 2 || item.state !== 0
      || !combatItems.has(itemTableId)) {
    return rejectDiscard(normalEvents, player, room.roomId, '该物品不可丢到地面');
  }
  if ((item.ownedQuantity >>> 0) <= 0 || (item.battleQuantity >>> 0) <= 0) {
    return rejectDiscard(normalEvents, player, room.roomId, '物品数量不足');
  }
  const visual = selectDropVisual(itemTableId, 1);
  if (!visual) return rejectDiscard(normalEvents, player, room.roomId, '该物品没有地面表现');

  const groundId = nextGroundItemId(room);
  if (player.cpu) {
    const nextOwned = (item.ownedQuantity >>> 0) - 1;
    const nextBattle = Math.min((item.battleQuantity >>> 0) - 1,
      nextOwned, battleUseMax(itemTableId));
    item.ownedQuantity = nextOwned;
    item.battleQuantity = Math.max(0, nextBattle);
    if (nextOwned === 0) replaceInventoryRecord(player, {...item, ownedQuantity: 0});
  } else {
    if (!callbacks.discard) {
      return rejectDiscard(normalEvents, player, room.roomId, '物品保存失败，请稍后再试');
    }
    let updated: InventoryWireRecord | undefined;
    try {
      updated = callbacks.discard({
        roomId: room.roomId,
        round: room.round,
        groundId,
        playerId: player.id,
        instanceId: id,
        itemTableId,
        expectedQuantity: item.ownedQuantity >>> 0,
        quantity: 1,
      });
    } catch {
      return rejectDiscard(normalEvents, player, room.roomId, '物品保存失败，请稍后再试');
    }
    if (!updated || (updated.instanceId >>> 0) !== id
        || (updated.itemTableId >>> 0) !== itemTableId) {
      return rejectDiscard(normalEvents, player, room.roomId, '物品数量已变化，请重新进入房间');
    }
    applyDiscardedRecord(player, updated, callbacks);
  }

  const state: GroundItemState = {
    id: groundId,
    itemTableId,
    quantity: 1,
    ...visual,
    x: player.x,
    y: player.y,
    z: player.z,
    source: 'DISCARD',
    ownerId: player.id,
    createdAt: now,
  };
  room.groundItems.push(state);
  pushGroundItemEvent(normalEvents, {
    roomId: room.roomId,
    type: 'groundItemDropped',
    message: '',
    playerId: player.id,
    targetId: state.id,
    value: state.quantity,
    x: state.x,
    y: state.y,
    z: state.z,
    groundItemDropped: {...state},
  });
  return true;
}

export function pickupGroundItem(room: GroundItemRoom, player: GroundItemRoomPlayer,
    groundId: string, callbacks: AcquireDiscardCallbacks,
    normalEvents: MsgRoomEvent[]): boolean {
  if (room.phase !== 'PLAYING' || !player.alive || player.combat.status !== 2) return false;
  const ground = room.groundItems.find(item => item.id === groundId);
  if (!ground) return false;
  const distance = Math.hypot(player.x - ground.x, player.y - ground.y, player.z - ground.z);
  if (!Number.isFinite(distance) || distance > GROUND_PICKUP_RADIUS) return false;
  const itemName = combatItems.get(ground.itemTableId)?.name ?? '道具';
  const requiredPetType = combatItems.get(ground.itemTableId)?.runtime.values.pickupPetType;
  if (requiredPetType !== undefined && requiredPetType > 0) {
    const petType = callbacks.petType?.(player.id);
    if (petType === undefined || (petType >>> 0) !== (requiredPetType >>> 0)) {
      return rejectPickup(room, player, ground, normalEvents, `${itemName}需要携带对应宠物才能拾取`);
    }
  }
  const rejection = callbacks.pickupRejection?.(player.id, ground);
  if (rejection) return rejectPickup(room, player, ground, normalEvents, rejection);

  let record: InventoryWireRecord | undefined;
  let refreshPlayerIds: readonly string[] = [];
  if (player.cpu) {
    record = acquireLocally(player, ground);
  } else {
    if (!callbacks.acquire) {
      return rejectPickup(room, player, ground, normalEvents, `暂时无法拾取${itemName}`);
    }
    try {
      const result = callbacks.acquire({
        roomId: room.roomId,
        round: room.round,
        groundId: ground.id,
        playerId: player.id,
        itemTableId: ground.itemTableId,
        quantity: ground.quantity,
        source: ground.source,
        ownerId: ground.ownerId,
      });
      record = result?.record;
      refreshPlayerIds = result?.refreshPlayerIds ?? [];
    } catch {
      return rejectPickup(room, player, ground, normalEvents, `${itemName}拾取保存失败，请稍后再试`);
    }
  }
  if (!record || !(record.instanceId >>> 0) || !(record.ownedQuantity >>> 0)
      || (record.itemTableId >>> 0) !== (ground.itemTableId >>> 0)) {
    return rejectPickup(room, player, ground, normalEvents, `暂时无法拾取${itemName}`);
  }

  applyAcquiredRecord(player, record, ground.itemTableId, callbacks, true);
  for (const playerId of refreshPlayerIds) {
    const target = room.players.get(playerId);
    if (target && target.id !== player.id) {
      applyAcquiredRecord(target, record, ground.itemTableId, callbacks);
    }
  }
  room.groundItems = room.groundItems.filter(item => item.id !== ground.id);
  pushGroundItemEvent(normalEvents, {
    roomId: room.roomId,
    type: 'groundItemPickedUp',
    message: `你拾取了${itemName} × ${ground.quantity}。`,
    itemName,
    playerId: player.id,
    targetId: ground.id,
    value: ground.quantity,
    x: ground.x,
    y: ground.y,
    z: ground.z,
    groundItemPickedUp: {id: ground.id, playerId: player.id,
      itemTableId: ground.itemTableId, quantity: ground.quantity},
  });
  pushGroundItemEvent(normalEvents, {
    roomId: room.roomId,
    type: 'groundItemRemoved',
    message: '',
    playerId: player.id,
    targetId: ground.id,
    value: 0,
    x: ground.x,
    y: ground.y,
    z: ground.z,
    groundItemRemoved: {id: ground.id},
  });
  callbacks.pickupSucceeded?.(player.id, ground, normalEvents);
  return true;
}

/** Server-side contact scan after movement; the simulation clock is caller-owned. */
export function advanceGroundItems(room: GroundItemRoom, now: number,
    callbacks: AcquireDiscardCallbacks, normalEvents: MsgRoomEvent[]): void {
  if (room.phase !== 'PLAYING') return;
  const lifetimeMs = Math.max(0, gameContent().rules.groundDrops.lifetimeSeconds) * 1000;
  const expired = room.groundItems.filter(ground => now - ground.createdAt >= lifetimeMs);
  if (expired.length) {
    room.groundItems = room.groundItems.filter(ground => now - ground.createdAt < lifetimeMs);
    for (const ground of expired) {
      pushGroundItemEvent(normalEvents, {
        roomId: room.roomId,
        type: 'groundItemRemoved',
        message: '',
        playerId: ground.ownerId ?? '',
        targetId: ground.id,
        value: 0,
        x: ground.x,
        y: ground.y,
        z: ground.z,
        groundItemRemoved: {id: ground.id},
      });
    }
  }
  const rejected = pickupRejections.get(roundKey(room));
  if (rejected) {
    for (const [key, notice] of rejected) {
      const player = room.players.get(notice.playerId);
      const ground = room.groundItems.find(item => item.id === notice.groundId);
      if (!player || !ground || !player.alive || player.combat.status !== 2
          || Math.hypot(player.x - ground.x, player.y - ground.y, player.z - ground.z) > GROUND_PICKUP_RADIUS) {
        rejected.delete(key);
      }
    }
  }
  for (const ground of [...room.groundItems]) {
    for (const player of room.players.values()) {
      if (pickupGroundItem(room, player, ground.id, callbacks, normalEvents)) break;
    }
  }
}

export function clearGroundItems(room: Pick<GroundItemRoom, 'roomId' | 'round' | 'groundItems'>): void {
  room.groundItems = [];
  const key = roundKey(room);
  groundCounters.delete(key);
  breachDropKeys.delete(key);
  pickupRejections.delete(key);
}

export function groundItemSnapshot(state: GroundItemState): GroundItemState {
  return {...state};
}
