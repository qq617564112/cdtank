import type {Point} from '../../battlefield';
import type {BotActor} from './controller';

export type RecoveryReason = 'LOCAL_LOOP';

/**
 * Track physical progress independently of targeting and short-lived
 * waypoints. Key selection belongs to the drive planner; this only reports a
 * pursuit that keeps circling one area so the controller can choose an exit.
 */
export class BotRecovery {
  private origin?: Point;
  private progressAt = 0;
  private observedAt = 0;
  private tracking = false;
  private routeOrigin?: Point;
  private routeProgressAt = 0;
  private retryAt = 0;
  private pendingReplan?: RecoveryReason;
  private replans = 0;
  private lastReason?: RecoveryReason;

  get stalledSeconds(): number {
    return this.tracking ? Math.max(0, this.observedAt - this.progressAt) / 1000 : 0;
  }

  get replanCount(): number {return this.replans;}
  get replanReason(): RecoveryReason | undefined {return this.lastReason;}
  get routeStalledSeconds(): number {
    return this.routeOrigin ? Math.max(0, this.observedAt - this.routeProgressAt) / 1000 : 0;
  }

  takeReplan(): RecoveryReason | undefined {
    const reason = this.pendingReplan;
    this.pendingReplan = undefined;
    return reason;
  }

  reset(): void {
    this.origin = undefined;
    this.tracking = false;
    this.routeOrigin = undefined;
    this.retryAt = 0;
    this.pendingReplan = undefined;
    this.lastReason = undefined;
  }

  observe(actor: BotActor, now: number): void {
    if (actor.combat?.getFlag?.(9) === 0 || now - this.observedAt > 1000) {
      this.reset();
      this.observedAt = now;
      if (actor.combat?.getFlag?.(9) === 0) return;
    }
    const threshold = Math.max(2, Math.min(12, (actor.movement?.speed ?? 48) * .25));
    if (!this.origin || !this.tracking
        || Math.hypot(actor.x - this.origin.x, actor.z - this.origin.z) >= threshold) {
      this.origin = {x: actor.x, y: actor.y, z: actor.z};
      this.progressAt = now;
    }
    this.observedAt = now;
  }

  /**
   * `needsMovement` keeps the stall timer running; `pursuing` also watches for
   * a route that stays inside a 96-unit area for eight seconds.
   */
  track(actor: BotActor, needsMovement: boolean, pursuing: boolean, now: number): void {
    // A trap can forbid translation; resume from the actual pose afterwards.
    if (actor.combat?.getFlag?.(9) === 0) return;
    const tracking = !actor.roleDisguise && needsMovement;
    if (pursuing && tracking) {
      if (!this.routeOrigin || Math.hypot(actor.x - this.routeOrigin.x, actor.z - this.routeOrigin.z) >= 96) {
        this.routeOrigin = {x: actor.x, y: actor.y, z: actor.z};
        this.routeProgressAt = now;
      } else if (now - this.routeProgressAt >= 8000 && now >= this.retryAt && !this.pendingReplan) {
        this.routeOrigin = undefined;
        this.retryAt = now + 2500;
        this.pendingReplan = 'LOCAL_LOOP';
        this.lastReason = 'LOCAL_LOOP';
        this.replans++;
      }
    } else this.routeOrigin = undefined;
    if (!this.tracking || !tracking) {
      this.origin = {x: actor.x, y: actor.y, z: actor.z};
      this.progressAt = now;
    }
    this.tracking = tracking;
  }
}
