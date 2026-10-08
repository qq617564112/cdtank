import {itemForHandler, gameContent} from '../../../../shared/content/catalog';
import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {RoleCombatState} from '../roles/combat-state';
import {combatSkills} from '../catalog';

export interface AmmoSlowState {
  skillId: number;
  expiresAt: number;
}

export interface AmmoSlowParticipant {
  id: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  attributesReady: boolean;
  recoveredMovement?: {speed: number; turn: number};
  ammoSlow?: AmmoSlowState;
}

/** Rebuilt hit eligibility installs the original movement skill for its table duration. */
export function startAmmoSlow(roomId: string, target: AmmoSlowParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[], itemId = itemForHandler('hit', 'slow').id): boolean {
  if (!target.alive || target.combat.status !== 2 || target.ammoSlow) return false;
  const skillId = gameContent().items.get(itemId)!.runtime.skillRoles.secondary;
  const slots = target.combat.record?.arrays.get(4);
  if ((!target.attributesReady && !target.recoveredMovement)
      || !slots || slots.includes(skillId) || !slots.includes(0)) {
    events.push({roomId, type: 'ammoSlowRejected', message: '角色移动资料或技能栏不可用',
      playerId: target.id, targetId: target.id, value: 0,
      x: target.x, y: target.y, z: target.z, skillId: skillId});
    return false;
  }
  const skill = combatSkills.get(skillId)!;
  target.combat.addSkill(skillId);
  target.ammoSlow = {skillId: skillId, expiresAt: now + skill.functions[0].t * 1000};
  recompute();
  events.push({roomId, type: 'ammoSlowed', message: `${gameContent().items.get(itemId)!.name}减速生效${skill.functions[0].t}秒`,
    playerId: target.id, targetId: target.id, value: skill.attributes.ItemMove,
    x: target.x, y: target.y, z: target.z, skillId: skillId});
  return true;
}

export function clearAmmoSlow(target: Pick<AmmoSlowParticipant, 'combat' | 'ammoSlow'>, recompute: () => void): void {
  if (!target.ammoSlow) return;
  target.combat.removeSkill(target.ammoSlow.skillId);
  delete target.ammoSlow;
  recompute();
}

export function advanceAmmoSlow(roomId: string, target: AmmoSlowParticipant, now: number,
  recompute: () => void, events: MsgRoomEvent[]): void {
  if (!target.ammoSlow || (target.alive && now < target.ammoSlow.expiresAt)) return;
  const skillId = target.ammoSlow.skillId;
  clearAmmoSlow(target, recompute);
  events.push({roomId, type: 'ammoSlowEnded', message: '减速结束',
    playerId: target.id, targetId: target.id, value: 0,
    x: target.x, y: target.y, z: target.z, skillId});
}
