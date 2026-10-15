import {gameContent} from '../../../../shared/content/catalog';
import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import {SKILL_STATUS_ARTWORK} from '../../assets/skill-status-artwork';

interface StatusNotification {skillId: number; effectId: number; expiresAt: number;}

function compareEffectIds(left: number, right: number): number {return left - right;}

/** Snapshot states persist until expiry; other notifications follow their source animation. */
export class HudPlayerStatuses {
  private readonly notifications = new Map<string, StatusNotification[]>();
  private readonly alivePlayers = new Set<string>();
  private readonly effects = new Set<number>();
  private readonly orderedEffects: number[] = [];

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
    const alive = this.alivePlayers;
    alive.clear();
    if (!this.notifications.size) return;
    for (const player of snapshot.players) if (player.alive) alive.add(player.id);
    for (const id of this.notifications.keys()) {
      if (!alive.has(id)) {this.notifications.delete(id); continue;}
      const statuses = this.notifications.get(id)!;
      let count = 0;
      for (const status of statuses) if (status.expiresAt > now) statuses[count++] = status;
      statuses.length = count;
      if (!count) this.notifications.delete(id);
    }
  }

  /** Reuse an unchanged published list; changed results own their storage. */
  current(player: PlayerSnapshot, serverNow: number, previous?: readonly number[]): readonly number[] {
    const effects = this.effects;
    effects.clear();
    if (player.alive) {
      const notifications = this.notifications.get(player.id);
      if (notifications) for (const status of notifications) effects.add(status.effectId);
      this.addSnapshotEffects(player.attackBoost, serverNow);
      this.addSnapshotEffects(player.defenseBoost, serverNow);
      this.addSnapshotEffects(player.speedBoost, serverNow);
      this.addSnapshotEffects(player.turnBoost, serverNow);
      this.addSnapshotEffects(player.trapRestraint, serverNow);
      this.addSnapshotEffects(player.trapTurnRestraint, serverNow);
      this.addSnapshotEffects(player.trapFireRestraint, serverNow);
    }
    const ordered = this.orderedEffects;
    ordered.length = 0;
    for (const effect of effects) ordered.push(effect);
    ordered.sort(compareEffectIds);
    if (previous?.length === ordered.length) {
      let unchanged = true;
      for (let index = 0; index < ordered.length; index++) {
        if (previous[index] !== ordered[index]) {unchanged = false; break;}
      }
      if (unchanged) return previous;
    }
    return ordered.slice();
  }

  private addSnapshotEffects(state: {skillId: number; expiresAt: number} | undefined, serverNow: number): void {
    if (!state || state.expiresAt <= serverNow) return;
    const effects = gameContent().skills.get(state.skillId)?.effects;
    if (!effects) return;
    for (const effect of effects) {
      if (SKILL_STATUS_ARTWORK.has(effect.effectId)) this.effects.add(effect.effectId);
    }
  }

  clear(): void {
    this.notifications.clear();
    this.alivePlayers.clear();
    this.effects.clear();
    this.orderedEffects.length = 0;
  }
}
