import {itemForHandler} from '../../../../shared/content/catalog';
import {combatItems, combatSkills} from '../catalog';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';
import type {MsgRoomEvent, PlaySkillEffectMessage} from '../../../../shared/protocols';

export interface SelfDestructRule {
  itemTableId: number;
  blastSkillId: number;
  damageSkillId: number;
  range: number;
  damage: number;
}

/** Original item17051 skill1 → 13151 Func15 → terminal19 Func2 HP-100. */
export function readSelfDestructRule(itemId = itemForHandler('passive', 'selfDestruct').id): SelfDestructRule | undefined {
  const item = combatItems.get(itemId);
  const blast = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const effect = blast?.functions[0];
  const damage = effect ? combatSkills.get(effect.y) : undefined;
  if (!item || !blast || blast.range <= 0 || effect?.type !== 15
      || !damage || damage.functions[0]?.type !== 2 || damage.attributes.HP >= 0) return;
  return {itemTableId: item.itemTableId, blastSkillId: blast.skillId, damageSkillId: damage.skillId,
    range: blast.range, damage: -damage.attributes.HP};
}

/** Resolve the rule from the confirmed owned part in its selected battle slot. */
function selectedSelfDestructRule(player: PlayerState): SelfDestructRule | undefined {
  const selectedParts = player.combat.record?.arrays.get(2);
  for (const [slot, instanceId] of player.ownedRoles.equipment().parts.entries()) {
    const record = player.inventory.find(value => (value.instanceId >>> 0) === (instanceId >>> 0));
    if (!record || record.state !== 2 || (record.ownedQuantity >>> 0) === 0
        || selectedParts?.[slot] !== record.itemTableId
        || combatItems.get(record.itemTableId)?.runtime.passive !== 'selfDestruct') continue;
    const rule = readSelfDestructRule(record.itemTableId);
    if (rule) return rule;
  }
}

export function hasSelectedSelfDestruct(player: PlayerState): boolean {
  return selectedSelfDestructRule(player) !== undefined;
}

function floatBits(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
}

export function selfDestructWorldEffect(skillId: number, x: number, z: number): PlaySkillEffectMessage {
  return {skillId, effectIndex: 0, duration: 0, roleId: 0, xBits: floatBits(x), zBits: floatBits(z)};
}

export function resolveSelfDestructDeath(room: Pick<RoomState, 'roomId' | 'phase' | 'mode' | 'players'>,
  deadOwner: PlayerState, center: {x: number; y: number; z: number}, now: number, events: MsgRoomEvent[],
  hit: (owner: PlayerState, target: PlayerState, damage: number, skillId: number) => void): void {
  const rule = selectedSelfDestructRule(deadOwner);
  if (!rule || room.phase !== 'PLAYING') return;
  events.push({roomId: room.roomId, type: 'selfDestructBlast', message: '',
    playerId: deadOwner.id, targetId: '', value: 0, x: center.x, y: center.y, z: center.z,
    skillId: rule.blastSkillId,
    playSkillEffect: selfDestructWorldEffect(rule.blastSkillId, center.x, center.z)});
  const half = rule.range / 2;
  for (const target of room.players.values()) {
    if (room.phase !== 'PLAYING') break;
    if (target.id === deadOwner.id || !target.alive || target.combat.status !== 2
        || (room.mode <= 3 && target.team === deadOwner.team)
        || Math.abs(target.x - center.x) > half || Math.abs(target.z - center.z) > half) continue;
    hit(deadOwner, target, rule.damage, rule.damageSkillId);
  }
}
