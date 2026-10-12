import {gameContent} from '../../../../shared/content/catalog';
import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {SKILL_STATUS_ARTWORK} from '../../assets/skill-status-artwork';

interface StatusNotification {skillId: number; effectId: number; expiresAt: number;}

/** Snapshot states persist until expiry; other notifications follow their source animation. */
export class HudPlayerStatuses {
  private readonly notifications = new Map<string, StatusNotification[]>();

  event(event: MsgRoomEvent, now: number): void {
    if (event.type === 'destroy') this.notifications.delete(event.targetId);
    const stop = event.stopSkillEffect;
    if (stop) this.stop(`P${stop.roleId}`, stop.skillId);
    if (event.skillId !== undefined && ['ammoSlowEnded', 'trapRestraintEnded'].includes(event.type)) {
      this.stop(event.targetId, event.skillId);
    }
    const play = event.playSkillEffect;
    if (play && play.roleId !== 0) this.play(`P${play.roleId}`, play.skillId, play.effectIndex, play.duration, now);
    if (event.type === 'ammoSlowed' && event.skillId !== undefined) {
      const duration = gameContent().skills.get(event.skillId)?.functions[0]?.t ?? 0;
      this.play(event.targetId, event.skillId, 0, duration, now);
    }
    const shot = event.shotPlayerResult;
    const item = shot ? gameContent().items.get(shot.itemId) : undefined;
    if (!item?.runtime.victimShotResult) return;
    const skill = [item.runtime.skillRoles.primary, item.runtime.skillRoles.secondary, item.runtime.skillRoles.tertiary]
      .map(id => gameContent().skills.get(id)).find(skill => skill?.triggerType === 8);
    if (skill) this.play(event.targetId, skill.skillId, 0, 0, now);
  }

  private play(id: string, skillId: number, effectIndex: number, duration: number, now: number): void {
    const effectId = gameContent().skills.get(skillId)?.effects[effectIndex]?.effectId;
    const artwork = effectId === undefined ? undefined : SKILL_STATUS_ARTWORK.get(effectId);
    if (!artwork) return;
    const previous = this.notifications.get(id) ?? [];
    const next = previous.filter(status => status.skillId !== skillId || status.effectId !== artwork.effectId);
    const expiresAt = Math.max(now + (duration > 0 ? duration : artwork.durationSeconds) * 1000,
      ...previous.filter(status => status.skillId === skillId && status.effectId === artwork.effectId).map(status => status.expiresAt));
    next.push({skillId, effectId: artwork.effectId, expiresAt});
    this.notifications.set(id, next);
  }

  private stop(id: string, skillId: number): void {
    const next = this.notifications.get(id)?.filter(status => status.skillId !== skillId) ?? [];
    if (next.length) this.notifications.set(id, next);
    else this.notifications.delete(id);
  }

  update(snapshot: MsgRoomSnapshot, now: number): void {
    if (snapshot.phase !== 'PLAYING') {this.clear(); return;}
    const alive = new Set(snapshot.players.filter(player => player.alive).map(player => player.id));
    for (const [id, statuses] of this.notifications) {
      const next = alive.has(id) ? statuses.filter(status => status.expiresAt > now) : [];
      if (next.length) this.notifications.set(id, next);
      else this.notifications.delete(id);
    }
  }

  current(player: PlayerSnapshot, serverNow: number): number[] {
    if (!player.alive) return [];
    const effects = new Set(this.notifications.get(player.id)?.map(status => status.effectId));
    for (const state of [player.attackBoost, player.defenseBoost, player.speedBoost, player.turnBoost,
      player.trapRestraint, player.trapTurnRestraint, player.trapFireRestraint]) {
      if (!state || state.expiresAt <= serverNow) continue;
      for (const effect of gameContent().skills.get(state.skillId)?.effects ?? []) {
        if (SKILL_STATUS_ARTWORK.has(effect.effectId)) effects.add(effect.effectId);
      }
    }
    return [...effects].sort((left, right) => left - right);
  }

  clear(): void {this.notifications.clear();}
}
