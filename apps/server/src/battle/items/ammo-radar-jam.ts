import type {MsgRoomEvent} from '../../../../shared/protocols';

const RADAR_JAM_SKILL_ID = 4008;
const RADAR_JAM_SECONDS = 15;
const RADAR_JAM_DURATION_MS = RADAR_JAM_SECONDS * 1000;

export interface AmmoRadarJamState {
  skillId: typeof RADAR_JAM_SKILL_ID;
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

/** Adopted2010 policy: an accepted hostile hit refreshes one real15-second marker-jam deadline. */
export function startAmmoRadarJam(roomId: string, target: AmmoRadarJamParticipant,
  now: number, events: MsgRoomEvent[]): boolean {
  if (!target.alive || target.combat.status !== 2 || !Number.isFinite(now)) return false;
  target.radarJam = {skillId: RADAR_JAM_SKILL_ID, expiresAt: now + RADAR_JAM_DURATION_MS};
  events.push({roomId, type: 'radarJammed', message: '雷达干扰弹生效15秒',
    playerId: target.id, targetId: target.id, value: RADAR_JAM_SECONDS,
    x: target.x, y: target.y, z: target.z, skillId: RADAR_JAM_SKILL_ID,
    playSkillEffect: {skillId: RADAR_JAM_SKILL_ID, effectIndex: 0,
      duration: RADAR_JAM_SECONDS, roleId: roleId(target.id), xBits: 0, zBits: 0}});
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
  clearAmmoRadarJam(target);
  events.push({roomId, type: 'skillStopped', message: '',
    playerId: target.id, targetId: target.id, value: 0,
    x: target.x, y: target.y, z: target.z, skillId: RADAR_JAM_SKILL_ID});
}
