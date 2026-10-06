/** Original global 630a60 is shared by frame-clock instances. */
export interface SkillEffectFrameClock {previousCompletion: number;}
export interface SkillEffectFrameDecision {steps: number; sleepMs?: number;}

/** Original 406154: elapsed work since completion, truncated Sleep, capped catch-up. */
export class SkillEffectFrameScheduler {
  readonly interval = 1 / 30;
  private initialized = false;
  private inverseDelta = 0;
  private averageRate = 0;
  private sampleCount = 0;
  private sampleDuration = 0;
  private clockStart = 0;
  private pending?: {decision: SkillEffectFrameDecision; readyAt: number};

  constructor(private readonly clock: SkillEffectFrameClock = {previousCompletion: 0}) {}

  /** Reconstruct the instance fields from 4060bc; the shared completion clock persists. */
  reset(): void {
    this.initialized = false;
    this.inverseDelta = 0;
    this.averageRate = 0;
    this.sampleCount = 0;
    this.sampleDuration = 0;
    this.clockStart = 0;
    this.pending = undefined;
  }

  get state(): Readonly<{
    previousCompletion: number; initialized: boolean; inverseDelta: number; averageRate: number;
    sampleCount: number; sampleDuration: number; clockStart: number; clockPrevious: number;
    clockPaused: boolean; clockPausedDuration: number;
  }> {
    return {previousCompletion: this.clock.previousCompletion, initialized: this.initialized,
      inverseDelta: this.inverseDelta, averageRate: this.averageRate, sampleCount: this.sampleCount,
      sampleDuration: this.sampleDuration, clockStart: this.clockStart, clockPrevious: this.clockStart,
      clockPaused: false, clockPausedDuration: 0};
  }

  /** Split the blocking native call at Sleep; now and complete() use clock seconds. */
  begin(now: number, resetClockNow = now): SkillEffectFrameDecision {
    let delta = now - this.clock.previousCompletion;
    if (!this.initialized) {
      this.clockStart = resetClockNow;
      this.initialized = true;
      delta = this.interval;
    }
    ++this.sampleCount;
    this.inverseDelta = 1 / delta;
    if (this.sampleDuration >= 1) {
      this.averageRate = this.sampleCount / this.sampleDuration;
      this.sampleCount = 0;
      this.sampleDuration = 0;
    }
    let decision: SkillEffectFrameDecision;
    if (delta > this.interval) {
      decision = {steps: Math.min(3, Math.trunc(delta / this.interval) + 1)};
      this.sampleDuration += delta;
    } else {
      decision = {steps: 1, sleepMs: Math.trunc((this.interval - delta) * 1000)};
      this.sampleDuration += this.interval;
    }
    return decision;
  }

  /** Native rereads the clock after Sleep, even if the requested delay was zero. */
  complete(now: number): void {this.clock.previousCompletion = now;}

  /** Nonblocking render-loop polling; a sleep decision yields until its deadline. */
  poll(now: number): number {
    if (this.pending) {
      if (now < this.pending.readyAt) return 0;
      const steps = this.pending.decision.steps;
      this.pending = undefined;
      this.complete(now);
      return steps;
    }
    const decision = this.begin(now);
    if (decision.sleepMs !== undefined && decision.sleepMs > 0) {
      this.pending = {decision, readyAt: now + decision.sleepMs / 1000};
      return 0;
    }
    this.complete(now);
    return decision.steps;
  }
}
