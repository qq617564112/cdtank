import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';
import type {SceneObjectSnapshot} from '../../../../shared/protocols';
import {selectBuildingToolTarget} from '../items/building-tool';

interface BuildingToolActor {
  alive: boolean;
  team: number;
  combat?: {status?: number; record?: {arrays: Map<number, Int32Array>}};
}

interface BuildingToolRoom {
  mode: number;
  map: {mapId: number};
  sceneObjects: readonly SceneObjectSnapshot[];
}

/** Rebuilt CPU policy: spend a delivered building tool only on a damaged own living Castle. */
export function buildingToolHotkey(catalog: CombatCatalog | undefined,
  inventory: readonly BattleItemRecord[] | undefined, actor: BuildingToolActor,
  room: BuildingToolRoom): number {
  const definition = catalog?.items.find(item => item.itemTableId === 502);
  if (!definition || definition.skillIds[0] !== 502) return 0;
  if (room.mode !== 1 || !actor.alive || actor.combat?.status !== 2) return 0;
  const hotkeys = actor.combat.record?.arrays.get(0);
  for (let slot = 5; slot <= 8; slot++) {
    const instance = (hotkeys?.[slot - 2] ?? 0) >>> 0;
    if (!instance) continue;
    const item = inventory?.find(record => (record.instanceId >>> 0) === instance);
    if (!item || item.itemTableId !== 502 || item.ownedQuantity <= 0 || item.battleQuantity <= 0) continue;
    if (selectBuildingToolTarget(room.map.mapId, room.sceneObjects, actor.team)) return slot;
    return 0;
  }
  return 0;
}
