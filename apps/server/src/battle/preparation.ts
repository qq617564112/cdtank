import {freezeSelectedBoundSource} from './roles/selected-bound-source';
import {setBattleHealth} from './health';
import type {AccountInventory} from '../account-store';
import type {TankConfig} from '../config';
import type {PlayerState} from './player-state';
import type {RoleOwnedSources} from '../accounts/owned/receive-pair';
import type {RoleProfilePayload} from '../accounts/profile/payload';
import {resolveBattlePartTableIds} from './roles/part-definitions';
import {applyKitbagAssignment, applyKitbagCancellation} from './items/kitbag-confirmation';
import type {KitbagAssignmentResult, KitbagCancellationResult} from '../accounts/kitbag-configuration';
import {combatItems} from './catalog';
import {recomputeBattleAttributes} from './attributes';
import {baseTankMaxHp} from './create-player';

interface PreparationRoom {
  phase: 'WAITING' | 'LOADING' | 'PLAYING' | 'FINISHED';
  ready: Set<string>;
}

/** A newly joined, never-started participant also needs account binding after
 * settlement. Existing round participants keep their frozen sources. */
export function canBindBattleSources(room: PreparationRoom, player: PlayerState): boolean {
  return room.phase === 'WAITING' || (room.phase === 'FINISHED' && player.combat.status === 0);
}

/** Rebuilt preparation starts at full life for the acknowledged loadout.
 * Inventory refresh during a live or settled round must not heal participants.
 */
function recomputePreparationHealth(room: PreparationRoom, player: PlayerState): void {
  recomputeBattleAttributes(player);
  if (!canBindBattleSources(room, player)) return;
  const maximum = player.lifeReady || player.attributesReady
    ? player.attributes.record.maxHp : baseTankMaxHp(player.tank);
  setBattleHealth(player, maximum, maximum);
}

function bindBattleParts(room: PreparationRoom, player: PlayerState): void {
  const tableIds = resolveBattlePartTableIds(player.ownedRoles.equipment().parts, player.inventory, combatItems);
  const previous = player.combat.record!.arrays.get(2)!;
  if (tableIds.every((id, slot) => id === (previous[slot] >>> 0))) return;
  player.combat.setArray(2, tableIds);
  room.ready.delete(player.id);
  recomputePreparationHealth(room, player);
}

/** Inventory refresh remains allowed outside WAITING; parts stay frozen then. */
export function bindBattleInventory(room: PreparationRoom, player: PlayerState,
  inventory: AccountInventory): void {
  player.inventory = inventory.records.map(record => ({...record}));
  player.combat.setArray(0, inventory.hotkeys);
  if (room.phase === 'WAITING') bindBattleParts(room, player);
}

/** World checks preparation/new-participant eligibility before binding. */
export function bindOwnedBattleSources(room: PreparationRoom, player: PlayerState,
  sources: RoleOwnedSources): void {
  if (player.ownedRoles.replace(sources)) {
    player.combat.dirty = true;
    room.ready.delete(player.id);
  }
  player.boundGear = freezeSelectedBoundSource(player.ownedRoles.snapshot().base);
  recomputePreparationHealth(room, player);
}

export function bindBattleEquipment(room: PreparationRoom, player: PlayerState,
  profile: RoleProfilePayload | undefined): void {
  if (player.ownedRoles.replaceProfile(profile)) {
    player.combat.dirty = true;
    room.ready.delete(player.id);
  }
  bindBattleParts(room, player);
  recomputePreparationHealth(room, player);
}

export function selectBattleTank(room: PreparationRoom, player: PlayerState, tank: TankConfig): void {
  if (player.tank.id !== tank.id) {
    player.ownedRoles.replace({...player.ownedRoles.snapshot(), equipment: undefined});
  }
  player.tank = tank;
  recomputeBattleAttributes(player);
  const maximum = player.lifeReady || player.attributesReady
    ? player.attributes.record.maxHp : baseTankMaxHp(tank);
  setBattleHealth(player, maximum, maximum);
  room.ready.delete(player.id);
}

export function confirmBattleKitbag(player: PlayerState,
  result: KitbagAssignmentResult | KitbagCancellationResult): void {
  if ('hotkeys' in result) applyKitbagAssignment(player.combat, result);
  else applyKitbagCancellation(player.combat, result);
}
