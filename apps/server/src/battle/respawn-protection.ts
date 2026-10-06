import type {MsgRoomEvent} from '../../../shared/protocols';

export const RESPAWN_PROTECTION_SKILL_ID = 30001;
export const RESPAWN_PROTECTION_DURATION_SECONDS = 5;
export const RESPAWN_PROTECTION_DURATION_MS = RESPAWN_PROTECTION_DURATION_SECONDS * 1000;

export interface RespawnProtectionState {
  skillId: typeof RESPAWN_PROTECTION_SKILL_ID;
  expiresAt: number;
}

export interface RespawnProtectionParticipant {
  id: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: {readonly status: number};
  respawnProtection?: RespawnProtectionState;
}

/**
 * Install the real-respawn protection once. The adopted source30001 policy is five
 * authoritative clock seconds; repeating the notification does not refresh it.
 */
export function applyRespawnProtection(roomId: string, player: RespawnProtectionParticipant,
  now: number, events: MsgRoomEvent[]): boolean {
  if (!player.alive || player.combat.status !== 2 || player.respawnProtection) return false;
  player.respawnProtection = {
    skillId: RESPAWN_PROTECTION_SKILL_ID,
    expiresAt: now + RESPAWN_PROTECTION_DURATION_MS,
  };
  events.push({roomId, type: 'respawnProtectionStarted', message: '',
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: RESPAWN_PROTECTION_SKILL_ID,
    playSkillEffect: {skillId: RESPAWN_PROTECTION_SKILL_ID, effectIndex: 0,
      duration: RESPAWN_PROTECTION_DURATION_SECONDS, roleId: Number(player.id.slice(1)),
      xBits: 0, zBits: 0}});
  return true;
}

/** Clear lifecycle state without inventing a source stop notification. */
export function clearRespawnProtection(player: RespawnProtectionParticipant): void {
  delete player.respawnProtection;
}

/** Emit the one natural-expiry event and clear the authority state. */
export function advanceRespawnProtection(roomId: string, player: RespawnProtectionParticipant,
  now: number, events: MsgRoomEvent[]): boolean {
  const protection = player.respawnProtection;
  if (!protection || now < protection.expiresAt) return false;
  delete player.respawnProtection;
  events.push({roomId, type: 'respawnProtectionEnded', message: '',
    playerId: player.id, targetId: player.id, value: 0,
    x: player.x, y: player.y, z: player.z, skillId: RESPAWN_PROTECTION_SKILL_ID});
  return true;
}
