import {QueuedPartEffects} from './queued-part-effects';
import {SkillEffectFrameScheduler} from './skill-effect-frame-scheduler';
import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import type {PlaySkillEffectMessage, StopSkillEffectMessage} from '../../../../shared/protocols/MsgRoomEvent';

export interface BattleSkillNotifications {
  play(message: PlaySkillEffectMessage): void;
  stop(message: StopSkillEffectMessage): void;
  /** World-position source skill WAV; only the airstrike policy below supplies a position. */
  worldSound?(skillId: number, effectIndex: number, position: readonly [number, number, number]): void;
  revive(roleId: number): void;
  clearRole(roleId: number): void;
  clearQueue(roleId: number): void;
  clear(): void;
  advanceTimers(deltaSeconds: number): void;
  update(steps: number): void;
}

/** The rebuilt server assigns P<number> player IDs; native notifications use that numeric role ID. */
export function battleRoleId(playerId: string): number {
  return Number(playerId.slice(1));
}

/** Couples original notification state to the Web battle's roles, rounds and frame clock. */
export class BattleSkillEffects {
  private readonly scheduler = new SkillEffectFrameScheduler();
  private readonly queuedParts: QueuedPartEffects;
  constructor(private readonly notifications: BattleSkillNotifications) {
    this.queuedParts = new QueuedPartEffects(notifications);
  }

  reconcileQueuedParts(playerId: string, skills: readonly number[], active: boolean): boolean {
    return this.queuedParts.reconcile(battleRoleId(playerId), skills, active);
  }

  event(event: MsgRoomEvent): void {
    if (event.playSkillEffect) this.play(event.playSkillEffect);
    if (event.stopSkillEffect) this.stop(event.stopSkillEffect);
    this.airstrikeSound(event);
  }

  /**
   * Adopted airstrike policy: a confirmed itemUsed13 cast or airstrikeImpact3013 owns one
   * one-shot source slot WAV at the event's authoritative world center. Other roleId0
   * notifications keep their original silent world-effect contract.
   */
  private airstrikeSound(event: MsgRoomEvent): void {
    const play = event.playSkillEffect;
    if (!play || play.roleId !== 0) return;
    const source = event.type === 'itemUsed' ? 13 : event.type === 'airstrikeImpact' ? 3013 : undefined;
    if (source === undefined || play.skillId !== source) return;
    this.notifications.worldSound?.(play.skillId, play.effectIndex, [event.x, event.y, event.z]);
  }

  play(message: PlaySkillEffectMessage): void {this.notifications.play(message);}
  stop(message: StopSkillEffectMessage): void {this.notifications.stop(message);}
  revive(playerId: string): void {this.notifications.revive(battleRoleId(playerId));}
  remove(playerId: string): void {
    this.queuedParts.remove(battleRoleId(playerId));
    this.notifications.clearRole(battleRoleId(playerId));
  }

  frame(deltaSeconds: number, nowSeconds = performance.now() / 1000): void {
    this.notifications.advanceTimers(deltaSeconds);
    const steps = this.scheduler.poll(nowSeconds);
    if (steps > 0) this.notifications.update(steps);
  }

  clear(): void {
    this.notifications.clear();
    this.queuedParts.clear();
    this.scheduler.reset();
  }
}
