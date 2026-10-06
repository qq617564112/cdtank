import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';
import type {KitbagInventory} from './inventory';

export interface ItemUseRoleState {
  status: number;
  /** Original role+0x309, separate from flag12 at+0x308. */
  trapPermission: number;
}

function findItem(inventory: KitbagInventory, instanceId: number): BattleItemRecord | undefined {
  const id = instanceId >>> 0;
  return inventory.primary.find(record => (record.instanceId >>> 0) === id)
    ?? inventory.secondary.find(record => (record.instanceId >>> 0) === id);
}

/** Original43d4dc; sending a request does not establish server success. */
export function requestItemUse(role: ItemUseRoleState | undefined, inventory: KitbagInventory,
  instanceId: number, send: (instanceId: number) => void): boolean {
  if (!role || role.status !== 2) return false;
  const record = findItem(inventory, instanceId);
  if (!record || (record.battleQuantity >>> 0) === 0) return false;
  if (classifyItemId(record.itemTableId) === 4) {
    if ((role.trapPermission & 255) === 0) return false;
    role.trapPermission = 0;
  }
  send(instanceId >>> 0);
  return true;
}

export interface TrapPlacementContext {
  /** Original engine virtual+4 result, distinct from a room's match mode. */
  engineMode: number;
  role?: ItemUseRoleState;
  hotkeys?: ArrayLike<number>;
  scenePresent: boolean;
  controllerPresent: boolean;
}

/** Original43d5f3; it does not check role status or expose a success return. */
export function requestTrapPlacement(context: TrapPlacementContext, inventory: KitbagInventory,
  instanceId: number, send: (instanceId: number) => void): void {
  const {role, hotkeys} = context;
  if (context.engineMode !== 4 || !role || !hotkeys) return;
  const id = instanceId >>> 0;
  let assigned = false;
  for (let slot = 0; slot < 7; slot++) assigned ||= (hotkeys[slot] >>> 0) === id;
  if (!assigned) return;
  const record = findItem(inventory, id);
  if (!record || classifyItemId(record.itemTableId) !== 4) return;
  if (!context.scenePresent || !context.controllerPresent || (record.battleQuantity >>> 0) === 0
    || (role.trapPermission & 255) === 0) return;
  role.trapPermission = 0;
  send(id);
}
