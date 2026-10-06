import {combatItems, combatSkills} from '../catalog';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';
import type {MsgRoomEvent, PlaySkillEffectMessage} from '../../../../shared/protocols';

export interface ExplosiveAmmoRule {
  itemTableId: 2005;
  blastSkillId: 4004;
  damageSkillId: 19;
  range: number;
  damage: number;
}

/** Original item2005 skill2 → 4004 Func15 → terminal19 Func2 HP-100. */
export function readExplosiveAmmoRule(): ExplosiveAmmoRule | undefined {
  const item = combatItems.get(2005);
  const blast = item ? combatSkills.get(item.skillIds[1]) : undefined;
  const effect = blast?.functions[0];
  const damage = effect ? combatSkills.get(effect.y) : undefined;
  if (!item || item.itemType !== 3 || item.skillIds[0] !== 2005 || item.skillIds[1] !== 4004
      || !blast || blast.skillId !== 4004 || blast.triggerType !== 8 || blast.target !== 1
      || blast.range !== 150 || blast.effects[0]?.effectId !== 9
      || effect?.type !== 15 || effect.y !== 19
      || !damage || damage.skillId !== 19 || damage.functions[0]?.type !== 2
      || damage.attributes.HP >= 0) return;
  return {itemTableId: 2005, blastSkillId: 4004, damageSkillId: 19,
    range: blast.range, damage: -damage.attributes.HP};
}

function floatBits(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
}

export function explosiveAmmoWorldEffect(skillId: number, x: number, z: number): PlaySkillEffectMessage {
  return {skillId, effectIndex: 0, duration: 0, roleId: 0, xBits: floatBits(x), zBits: floatBits(z)};
}

export function resolveExplosiveAmmoBlast(room: Pick<RoomState, 'roomId' | 'phase' | 'mode' | 'players'>,
  owner: PlayerState, center: {x: number; y: number; z: number}, now: number, events: MsgRoomEvent[],
  hit: (owner: PlayerState, target: PlayerState, damage: number, skillId: number) => void): void {
  const rule = readExplosiveAmmoRule();
  if (!rule || room.phase !== 'PLAYING') return;
  events.push({roomId: room.roomId, type: 'explosiveAmmoBlast', message: '',
    playerId: owner.id, targetId: '', value: 0, x: center.x, y: center.y, z: center.z,
    skillId: rule.blastSkillId,
    playSkillEffect: explosiveAmmoWorldEffect(rule.blastSkillId, center.x, center.z)});
  const half = rule.range / 2;
  for (const target of room.players.values()) {
    if (room.phase !== 'PLAYING') break;
    if (target.id === owner.id || !target.alive || target.combat.status !== 2
        || (room.mode <= 3 && target.team === owner.team)
        || Math.abs(target.x - center.x) > half || Math.abs(target.z - center.z) > half) continue;
    hit(owner, target, rule.damage, rule.damageSkillId);
  }
}
