import {gameContent} from '../../../shared/content/catalog';
import {resolveItemHotkey} from '../../../shared/combat/item-hotkeys';
import {calculateFoodHealing} from '../battle/roles/food-healing';
import type {PlayerState} from '../battle/player-state';
import type {ItemDefinition} from '../../../shared/content/types';

const kinds = ['ammo', 'heal', 'attack', 'defense', 'speed', 'turn', 'invincibility',
  'concealment', 'trap', 'other'] as const;

function activeEffect(player: PlayerState, use: string | undefined): {expiresAt: number} | undefined {
  switch (use) {
    case 'attack': return player.attackBoost;
    case 'defense': return player.defenseBoost;
    case 'speed': return player.speedBoost;
    case 'turn': return player.turnBoost;
    case 'invincibility': return player.invincibility;
    case 'camouflage': return player.opticalCamouflage;
    case 'disguise': return player.roleDisguise;
    default: return undefined;
  }
}

/** Own inventory and effect state; authority still decides whether a request succeeds. */
export function learningItemState(player: PlayerState, maximumHp: number, now: number) {
  const catalog = gameContent();
  const hotkeys = player.combat.record?.arrays.get(0);
  const skillSlots = player.combat.record?.arrays.get(4);
  const mask = [true, player.alive && player.combat.status === 2];
  const features: number[] = [];
  const remaining = (state: {expiresAt: number} | undefined) => state
    ? Math.max(0, Math.min(2, (state.expiresAt - now) / 30000)) : 0;
  for (let slot = 2; slot <= 8; slot++) {
    const instanceId = (hotkeys?.[slot - 2] ?? 0) >>> 0;
    const record = player.inventory.find(item => (item.instanceId >>> 0) === instanceId);
    const definition = record ? catalog.items.get(record.itemTableId) : undefined;
    const use = definition?.runtime.use;
    const skill = definition ? catalog.skills.get(definition.runtime.skillRoles.primary) : undefined;
    const functionType = skill?.functions[0]?.type;
    const healing = use === 'heal' && skill ? Math.max(0, Math.min(maximumHp - player.hp,
      calculateFoodHealing(skill.attributes.HP,
        player.attributesReady ? player.combat.roleFloatFields.get(0x8c) : undefined))) : 0;
    const resolved = resolveItemHotkey(slot, true, hotkeys, player.inventory);
    let available = !!record && record.ownedQuantity > 0 && record.battleQuantity > 0
      && player.alive && player.combat.status === 2 && resolved.accepted
      && resolved.command.kind !== 'none' && resolved.command.kind !== 'empty';
    if (resolved.command.kind === 'placeTrap') available &&= (player.combat.trapPermission & 255) !== 0;
    if (use === 'heal') {
      available &&= !player.lastStand && healing > 0 && skill?.target === 1
        && skill.triggerType === 1 && functionType === 2;
    } else if (['attack', 'defense', 'speed', 'turn', 'invincibility', 'camouflage', 'disguise'].includes(use ?? '')) {
      const expected = use === 'invincibility' ? 6 : use === 'camouflage' ? 7 : use === 'disguise' ? 8 : 1;
      available &&= !!skill && skill.target === 1 && skill.triggerType === 1 && functionType === expected
        && !activeEffect(player, use) && !!skillSlots && skillSlots.length === 16
        && skillSlots.includes(0) && !skillSlots.includes(skill.skillId);
      if (use === 'speed' || use === 'turn') available &&= player.attributesReady || !!player.recoveredMovement;
      if (use === 'camouflage' || use === 'disguise') available &&= !player.opticalCamouflage && !player.roleDisguise;
    }
    mask.push(available);
    const kind = itemKind(definition);
    features.push(...kinds.map(value => Number(value === kind)), healing / Math.max(1, maximumHp),
      (skill?.functions[0]?.t ?? 0) / 30, remaining(activeEffect(player, use)));
  }
  features.push(...[player.attackBoost, player.defenseBoost, player.speedBoost, player.turnBoost,
    player.invincibility, player.opticalCamouflage, player.roleDisguise, player.respawnProtection,
    player.lastStand, player.trapRestraint, player.trapTurnRestraint, player.trapFireRestraint,
    player.burn ? {expiresAt: player.burn.startedAt + player.burn.ticks * player.burn.intervalMs} : undefined,
    player.ammoSlow, player.radarJam].map(remaining));
  return {mask, features};
}

function itemKind(item: ItemDefinition | undefined): typeof kinds[number] | undefined {
  if (!item) return undefined;
  if (item.kind === 'ammo' || item.kind === 'trap') return item.kind;
  const use = item.runtime.use;
  if (use === 'camouflage' || use === 'disguise') return 'concealment';
  return kinds.find(kind => kind === use) ?? 'other';
}
