import {combatItems, combatItemSkills, combatSkills} from '../catalog';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';
import type {MsgRoomEvent, PlaySkillEffectMessage} from '../../../../shared/protocols';

export interface SelfDestructRule {
  itemTableId: 17051;
  blastSkillId: 13151;
  damageSkillId: 19;
  range: number;
  damage: number;
}

/** Original item17051 skill1 → 13151 Func15 → terminal19 Func2 HP-100. */
export function readSelfDestructRule(): SelfDestructRule | undefined {
  const item = combatItems.get(17051);
  const blast = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const effect = blast?.functions[0];
  const damage = effect ? combatSkills.get(effect.y) : undefined;
  if (!item || item.itemType !== 12 || item.skillIds[0] !== 13151
      || !blast || blast.skillId !== 13151 || blast.triggerType !== 6 || blast.target !== 1
      || blast.range !== 150 || blast.effects[0]?.effectId !== 9
      || effect?.type !== 15 || effect.y !== 19
      || !damage || damage.skillId !== 19 || damage.functions[0]?.type !== 2
      || damage.attributes.HP >= 0) return;
  return {itemTableId: 17051, blastSkillId: 13151, damageSkillId: 19,
    range: blast.range, damage: -damage.attributes.HP};
}

/** The selected owned 17051 part is the source; 13151 is a death trigger, not a passive stat skill. */
export function hasSelectedSelfDestruct(player: PlayerState): boolean {
  const parts = player.ownedRoles.equipment().parts;
  const owned = parts.some(instanceId => {
    const record = player.inventory.find(value => (value.instanceId >>> 0) === (instanceId >>> 0));
    return record !== undefined && record.itemTableId === 17051 && record.state === 2
      && (record.ownedQuantity >>> 0) > 0
      && combatItemSkills.get(record.itemTableId)?.skillIds.includes(13151) === true;
  });
  if (!owned) return false;
  const selectedParts = player.combat.record?.arrays.get(2);
  return selectedParts !== undefined && Array.from(selectedParts).includes(17051);
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
  const rule = readSelfDestructRule();
  if (!rule || room.phase !== 'PLAYING' || !hasSelectedSelfDestruct(deadOwner)) return;
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
