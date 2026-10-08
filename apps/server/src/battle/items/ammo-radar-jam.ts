import {itemForHandler, gameContent} from '../../../../shared/content/catalog';
import type {MsgRoomEvent, PlaySkillEffectMessage} from '../../../../shared/protocols';

export interface AmmoRadarJamState {
  skillId: number;
  durationSeconds: number;
  expiresAt: number;
}

export interface AmmoRadarJamParticipant {
  id: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: {status: number};
  radarJam?: AmmoRadarJamState;
}

function roleId(playerId: string): number {
  const id = Number(playerId.slice(1));
  return Number.isFinite(id) ? id : 0;
}

/** The accepted hit owns this one-shot4008 notification; the radarJammed event stays state-only. */
export function ammoRadarJamSkillEffect(target: AmmoRadarJamParticipant): PlaySkillEffectMessage {
  const state = target.radarJam!;
  return {skillId: state.skillId, effectIndex: 0, duration: state.durationSeconds,
    roleId: roleId(target.id), xBits: 0, zBits: 0};
}

/** Adopted2010 policy: an accepted hostile hit refreshes one real15-second marker-jam deadline. */
export function startAmmoRadarJam(roomId: string, target: AmmoRadarJamParticipant,
  now: number, events: MsgRoomEvent[], itemId = itemForHandler('hit', 'radarJam').id): boolean {
  if (!target.alive || target.combat.status !== 2 || !Number.isFinite(now)) return false;
  const rule = gameContent().items.get(itemId)!;
  const skillId = rule.runtime.skillRoles.secondary, durationSeconds = rule.runtime.values.durationSeconds;
  target.radarJam = {skillId, durationSeconds, expiresAt: now + durationSeconds * 1000};
  events.push({roomId, type: 'radarJammed', message: `${gameContent().items.get(itemId)!.name}生效${durationSeconds}秒`,
    playerId: target.id, targetId: target.id, value: durationSeconds,
    x: target.x, y: target.y, z: target.z, skillId});
  return true;
}

export function clearAmmoRadarJam(target: {radarJam?: AmmoRadarJamState}): boolean {
  if (!target.radarJam) return false;
  delete target.radarJam;
  return true;
}

export function advanceAmmoRadarJam(roomId: string, target: AmmoRadarJamParticipant,
  now: number, events: MsgRoomEvent[]): void {
  if (!target.radarJam || (target.alive && now < target.radarJam.expiresAt)) return;
  const skillId = target.radarJam.skillId;
  clearAmmoRadarJam(target);
  events.push({roomId, type: 'skillStopped', message: '',
    playerId: target.id, targetId: target.id, value: 0,
    x: target.x, y: target.y, z: target.z, skillId});
}
