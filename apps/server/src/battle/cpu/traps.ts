import {combatItems} from '../catalog';
import type {GroundTrapSnapshot} from '../../../../shared/protocols';
import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';
import {readTrapSweepRule, selectSweepTraps} from '../items/trap-sweep';

interface TrapActor {
  id: string;
  x: number;
  z: number;
  alive: boolean;
  team: number;
  combat?: {
    status?: number;
    trapPermission?: number;
    record?: {arrays: Map<number, Int32Array>};
  };
  inventory?: readonly BattleItemRecord[];
}

interface TrapEnemy {
  x: number;
  z: number;
  alive: boolean;
}

function usableSlot(actor: TrapActor, slot: number): BattleItemRecord | undefined {
  const hotkeys = actor.combat?.record?.arrays.get(0);
  const instance = (hotkeys?.[slot - 2] ?? 0) >>> 0;
  if (!instance) return undefined;
  const item = actor.inventory?.find(record => (record.instanceId >>> 0) === instance);
  return item && item.ownedQuantity > 0 && item.battleQuantity > 0 ? item : undefined;
}

function trapItemSlot(actor: TrapActor, itemTableId: number): number {
  for (let slot = 2; slot <= 4; slot++) {
    const item = usableSlot(actor, slot);
    if (item?.itemTableId === itemTableId) return slot;
  }
  return 0;
}

function nearbyOwnTrap(traps: readonly GroundTrapSnapshot[], actor: TrapActor, now: number): boolean {
  return traps.some(trap => trap.ownerId === actor.id && now < trap.expiresAt
    && Math.hypot(trap.x - actor.x, trap.z - actor.z) <= 60);
}

function visibleNearbyEnemy(actor: TrapActor, enemies: readonly TrapEnemy[], range: number): boolean {
  return enemies.some(enemy => enemy.alive
    && Math.hypot(enemy.x - actor.x, enemy.z - actor.z) <= range);
}

/** Rebuilt policy: select an ordinary slot for an authority-owned ground trap placement. */
export function trapPlacementHotkey(actor: TrapActor, enemies: readonly TrapEnemy[],
  traps: readonly GroundTrapSnapshot[], now: number, retreating = false): number {
  if (!actor.alive || actor.combat?.status !== 2
      || ((actor.combat.trapPermission ?? 0) & 0xff) === 0
      || !visibleNearbyEnemy(actor, enemies, 300)) return 0;
  if (nearbyOwnTrap(traps, actor, now)) return 0;
  const half = enemies.some(enemy => enemy.alive
    && Math.abs(enemy.x - actor.x) <= 50 && Math.abs(enemy.z - actor.z) <= 50);
  if (half) {
    const timed = trapItemSlot(actor, [...combatItems.values()].find(item => item.runtime.trap === 'timedBomb')!.itemTableId);
    if (timed) return timed;
  }
  if (retreating || visibleNearbyEnemy(actor, enemies, 160)) {
    for (const item of combatItems.values()) {
      if (!item.runtime.trap || item.runtime.trap === 'timedBomb') continue;
      const itemTableId = item.itemTableId;
      const slot = trapItemSlot(actor, itemTableId);
      if (slot) return slot;
    }
  }
  return 0;
}

/** Rebuilt policy: select item12 only when a real hostile active trap is in range. */
export function trapSweepHotkey(actor: TrapActor, traps: readonly GroundTrapSnapshot[],
  mode: number, now: number): number {
  if (!actor.alive || actor.combat?.status !== 2 || !traps.length) return 0;
  const rule = readTrapSweepRule();
  if (!rule) return 0;
  const hostile = traps.filter(trap => trap.ownerId !== actor.id
    && (mode >= 4 || trap.team !== actor.team));
  if (!selectSweepTraps(hostile, actor, now, rule.radius).length) return 0;
  for (let slot = 5; slot <= 8; slot++) {
    if (usableSlot(actor, slot)?.itemTableId === rule.itemTableId) return slot;
  }
  return 0;
}
