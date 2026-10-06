import type {ItemUseRequest} from '../../../../shared/protocols/MsgRoomEvent';
import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';
import {resolveItemHotkey} from '../../../../shared/combat/item-hotkeys';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {requestItemUse, requestTrapPlacement} from './item-use';
import {requestRoleAmmoSelection} from './role-ammo-request';
import {requestTreasureItemUse} from './treasure-item-use';
import {isTreasureItem} from '../../../../shared/combat/treasure-items';
import type {RoleCombatState} from '../roles/combat-state';

export function dispatchItemHotkey(slot: number, role: RoleCombatState,
  records: readonly BattleItemRecord[], selectAmmo: (slot: number) => void,
  send: (request: ItemUseRequest) => void): void {
  const hotkeys = role.record?.arrays.get(0);
  const resolved = resolveItemHotkey(slot, true, hotkeys, records);
  if (!resolved.accepted) return;
  const command = resolved.command;
  const inventory = {
    primary: records.filter(record => classifyInventoryCategory(record.itemTableId) === 1),
    secondary: records.filter(record => classifyInventoryCategory(record.itemTableId) === 2),
  };
  if (command.kind === 'selectAmmo') {
    requestRoleAmmoSelection(role, inventory, command.slot, selectAmmo);
    return;
  }
  if (command.kind === 'useItem') {
    const record = records.find(value => (value.instanceId >>> 0) === (command.instanceId >>> 0));
    if (record && isTreasureItem(record.itemTableId)) {
      requestTreasureItemUse(role, record, instanceId => send({kind: 'useItem', instanceId}));
      return;
    }
    requestItemUse(role, inventory, command.instanceId,
      instanceId => send({kind: 'useItem', instanceId}));
  } else if (command.kind === 'placeTrap') {
    // This entry is called only in the rebuilt active gameplay state, equivalent to engine state4.
    requestTrapPlacement({engineMode: 4, role, hotkeys, scenePresent: true, controllerPresent: true},
      inventory, command.instanceId, instanceId => send({kind: 'placeTrap', instanceId}));
  }
}
