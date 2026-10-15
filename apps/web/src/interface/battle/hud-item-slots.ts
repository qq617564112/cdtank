import {defaultAmmoId} from '../../../../shared/content/catalog';
import type {CombatCatalog, CombatItemDefinition} from '../../../../shared/combat/catalog';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {HudCombatSnapshot} from './hud-combat-state';

export interface HudItemSlot {
  slot: number;
  itemTableId?: number;
  instanceId?: number;
  item?: CombatItemDefinition;
  quantity?: number;
  infinite: boolean;
  ammoSelected: boolean;
  itemCursor: boolean;
  cooldownFraction?: number;
  cooldownBinding?: 'reload-timing' | 'effect-expiry';
  remainingSeconds?: number;
}

/** Continuous reload progress only invalidates the shortcut whose display changes. */
export function sameHudItemSlot(left: HudItemSlot, right: HudItemSlot): boolean {
  return left === right || left.slot === right.slot && left.itemTableId === right.itemTableId
    && left.instanceId === right.instanceId && left.item === right.item && left.quantity === right.quantity
    && left.infinite === right.infinite && left.ammoSelected === right.ammoSelected
    && left.itemCursor === right.itemCursor && left.cooldownFraction === right.cooldownFraction
    && left.cooldownBinding === right.cooldownBinding && left.remainingSeconds === right.remainingSeconds;
}

/** Shared confirmed bindings for vector graphics and the shortcut interaction layer. */
export function hudItemSlots(combat: HudCombatSnapshot, catalog: CombatCatalog, inventory: ResInventory | undefined,
  selectedItemSlot: number | undefined, reloadFraction: number, serverNow = combat.serverTime): HudItemSlot[] {
  const reloadSlot = combat.selectedAmmoSlot === 0 ? 1 : combat.selectedAmmoSlot;
  return Array.from({length: 8}, (_, index) => {
    const slot = index + 1, instanceId = slot === 1 ? undefined : inventory?.hotkeys[slot - 2];
    const record = instanceId === undefined ? undefined
      : inventory?.records.find(value => (value.instanceId >>> 0) === (instanceId >>> 0));
    const ammo = slot >= 2 && slot <= 4 ? combat.ammoSlots.find(value => value.slot === slot) : undefined;
    const quantity = slot === 1 ? undefined : ammo?.quantity ?? record?.battleQuantity;
    if (slot !== 1 && (quantity !== undefined && quantity <= 0
        || record !== undefined && record.ownedQuantity <= 0)) {
      return {slot, infinite: false, ammoSelected: false, itemCursor: false};
    }
    const itemTableId = slot === 1 ? defaultAmmoId() : ammo?.itemTableId ?? record?.itemTableId;
    const item = catalog.items.find(value => value.itemTableId === itemTableId);
    const state: HudItemSlot = {
      slot, instanceId, itemTableId, item, infinite: slot === 1,
      quantity,
      ammoSelected: slot <= 4 && slot === reloadSlot && itemTableId !== undefined,
      itemCursor: slot >= 5 && slot === selectedItemSlot && !!record
        && (record.ownedQuantity >>> 0) > 0 && (record.battleQuantity >>> 0) > 0,
    };
    return Object.assign(state, hudItemCooldown(combat, slot, item, state.ammoSelected, reloadFraction, serverNow));
  });
}

export function hudItemCooldown(combat: HudCombatSnapshot, slot: number, item: CombatItemDefinition | undefined,
  ammoSelected: boolean, reloadFraction: number, serverNow = combat.serverTime):
    Pick<HudItemSlot, 'remainingSeconds' | 'cooldownFraction' | 'cooldownBinding'> | undefined {
  if (slot <= 4 && ammoSelected && combat.alive && combat.reload
      && combat.reload.duration > 0 && combat.reload.startedAt > 0) {
    const remainingSeconds = combat.reload.duration * (1 - reloadFraction);
    if (remainingSeconds > 0) return {remainingSeconds, cooldownFraction: 1 - reloadFraction,
      cooldownBinding: 'reload-timing'};
  } else if (slot >= 5 && combat.alive) {
    const effect = combat.activeEffects.find(value => item?.skillIds.includes(value.skillId) && value.expiresAt > serverNow);
    if (effect) return {remainingSeconds: (effect.expiresAt - serverNow) / 1000,
      cooldownFraction: 1, cooldownBinding: 'effect-expiry'};
  }
}
