import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';

export interface DefenseBoostState {
  skillId: 5;
  expiresAt: number;
  defensePercent: number;
  defenseBonus: number;
  baseDefense: number;
  boostedDefense: number;
  source: 'original-attributes' | 'rebuilt-tank';
}

export interface DefenseDrinkParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
  tank: {defense: number};
  armorReady?: boolean;
  recoveredArmor?: {defensePercent: number; defenseBonus: number};
  attributesReady?: boolean;
  attributes?: {values?: {roleFloats: Map<number, number>; roleIntegers: Map<number, number>}};
  defenseBoost?: DefenseBoostState;
}

/** Rebuilt self-target authority; source skill5 supplies duration and defense values. */
export function applyDefenseDrink(roomId: string, player: DefenseDrinkParticipant,
  request: {kind: string; instanceId: number}, now: number, recompute: () => void,
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.itemTableId !== 5 || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const definition = combatItems.get(5);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.skillId !== 5 || skill.target !== 1 || skill.triggerType !== 1
      || skill.functions[0]?.type !== 1) return;
  const reject = (message: string): void => {
    events.push({roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  const slots = player.combat.record?.arrays.get(4);
  if (player.defenseBoost || slots?.includes(5)) {
    reject('防御提升效果已生效');
    return;
  }
  if (!slots || slots.length !== 16 || !slots.includes(0)) {
    reject('技能栏已满，无法使用道具');
    return;
  }
  try {
    if (consumeItem && !consumeItem(player.id, item.instanceId, item.ownedQuantity, item.itemTableId)) {
      reject('物品数量已变化，请重新进入房间');
      return;
    }
  } catch {
    reject('物品保存失败，请稍后再试');
    return;
  }
  const originalBase = originalDefense(player);
  const tankDefense = player.tank.defense;
  const fallbackBase = Number.isFinite(tankDefense) ? Math.max(0, tankDefense) : 0;
  item.ownedQuantity -= 1;
  item.battleQuantity -= 1;
  player.combat.addSkill(5);
  recompute();
  const originalBoosted = originalDefense(player);
  const hasOriginal = originalBase !== undefined && originalBoosted !== undefined;
  const baseDefense = hasOriginal ? originalBase : fallbackBase;
  const fallbackBoosted = Math.fround(baseDefense * (1 + skill.attributes.Def / 100)
    + skill.attributes.DefBonus);
  const candidate = hasOriginal ? originalBoosted : fallbackBoosted;
  player.defenseBoost = {skillId: 5, expiresAt: now + skill.functions[0].t * 1000,
    defensePercent: skill.attributes.Def, defenseBonus: skill.attributes.DefBonus,
    baseDefense, boostedDefense: Number.isFinite(candidate) ? Math.max(baseDefense, candidate) : baseDefense,
    source: hasOriginal ? 'original-attributes' : 'rebuilt-tank'};
  events.push({roomId, type: 'itemUsed', message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: 5,
    playSkillEffect: {skillId: 5, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}

/** Remove only the temporary skill installed by the defense drink. */
export function clearDefenseDrink(player: DefenseDrinkParticipant, recompute: () => void): void {
  if (!player.defenseBoost) return;
  const slot = player.combat.record?.arrays.get(4)?.indexOf(5) ?? -1;
  if (slot !== -1) player.combat.removeSkillAt(slot);
  delete player.defenseBoost;
  recompute();
}

export function advanceDefenseDrink(roomId: string, player: DefenseDrinkParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[]): void {
  if (!player.defenseBoost || (player.alive && now < player.defenseBoost.expiresAt)) return;
  clearDefenseDrink(player, recompute);
  events.push({roomId, type: 'skillStopped', message: '', playerId: player.id,
    targetId: player.id, value: 0, x: player.x, y: player.y, z: player.z, skillId: 5,
    stopSkillEffect: {skillId: 5, roleId: Number(player.id.slice(1))}});
}

/** Original defense fields; combining them into armor is a rebuilt interpretation. */
function originalDefense(player: DefenseDrinkParticipant): number | undefined {
  const independent = player.armorReady ? player.recoveredArmor : undefined;
  if (!independent && !player.attributesReady) return undefined;
  const values = player.attributes?.values;
  const percent = independent?.defensePercent ?? values?.roleFloats.get(0x7c);
  const bonus = independent?.defenseBonus ?? values?.roleIntegers.get(0x88);
  if (percent === undefined || bonus === undefined
      || !Number.isFinite(percent) || !Number.isFinite(bonus)) return undefined;
  const total = percent + bonus;
  return Number.isFinite(total) ? Math.max(0, total) : undefined;
}

/** Rebuilt incremental mitigation over unchanged projectile damage, with scale100. */
export function defenseAdjustedDamage(damage: number, boost: DefenseBoostState | undefined,
  now: number): number {
  if (!boost || now >= boost.expiresAt) return damage;
  if (!Number.isFinite(damage) || !Number.isFinite(boost.baseDefense)
      || !Number.isFinite(boost.boostedDefense)) return damage;
  const base = Math.max(0, boost.baseDefense);
  const boosted = Math.max(base, boost.boostedDefense);
  const ratio = Math.max(0, Math.min(1, (100 + base) / (100 + boosted)));
  return damage * ratio;
}
