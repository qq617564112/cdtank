import type {Scene} from '@babylonjs/core';

/** World render targets use the selected scale or one of two lower steps. */
const FACTORS = [1, .875, .75] as const;
/** Frames aim for 60 FPS, or for the display's own rate once a step down shows it presents less often. */
const TARGET_FRAME_MS = 1000 / 60;
/** A one-second sample is slow above 110% of the target interval and steady within 104%. */
const SLOW_RATIO = 1.1;
const STEADY_RATIO = 1.04;
/** The shortest single frame of the last ten samples reveals the presentation interval. */
const PERIOD_SAMPLES = 10;
/** Render work below this share of the frame interval leaves the GPU as the likely limit. */
const RENDER_CPU_SHARE = .7;
/** Hidden pages and loading stalls restart the sample. */
const PAUSE_MS = 250;
const SAMPLE_MS = 1000;
const RAISE_SAMPLES = 4;
const MAX_RAISE_SAMPLES = 60;
const HOLD_SAMPLES = 30;
const MAX_HOLD_SAMPLES = 600;

const controllers = new WeakMap<Scene, DynamicResolution>();

export function registerDynamicResolution(scene: Scene, controller: DynamicResolution): void {
  controllers.set(scene, controller);
}

/** Only battle frames are sampled; lobby and loading screens keep the selected scale. */
export function setDynamicResolutionActive(scene: Scene, active: boolean): void {
  controllers.get(scene)?.setActive(active);
}

/** Lowers the world resolution while GPU-limited frames miss the frame budget. */
export class DynamicResolution {
  private active = false;
  private changed = false;
  private level = 0;
  private previousFrameAt?: number;
  private sampleStartedAt = 0;
  private frames = 0;
  private renderCpu = 0;
  private shortestFrame = Number.POSITIVE_INFINITY;
  private periods: number[] = [];
  private cappedFrameMs?: number;
  private slowSamples = 0;
  private steadySamples = 0;
  private raiseSamples = RAISE_SAMPLES;
  private samplesSinceRaise = Number.POSITIVE_INFINITY;
  private holdSamples = 0;
  private holdDuration = HOLD_SAMPLES;
  private trial?: {interval: number; samples: number};

  get factor(): number {
    return FACTORS[this.level];
  }

  /** Each battle starts from the selected scale with fresh history. */
  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.changed ||= this.level !== 0;
    this.level = 0;
    this.previousFrameAt = undefined;
    this.periods = [];
    this.cappedFrameMs = undefined;
    this.slowSamples = this.steadySamples = this.holdSamples = 0;
    this.raiseSamples = RAISE_SAMPLES;
    this.samplesSinceRaise = Number.POSITIVE_INFINITY;
    this.holdDuration = HOLD_SAMPLES;
    this.trial = undefined;
  }

  /** Returns true when the world targets should take a new factor. */
  record(startedAt: number, renderCpuMs: number): boolean {
    if (this.active) this.sample(startedAt, renderCpuMs);
    const changed = this.changed;
    this.changed = false;
    return changed;
  }

  private sample(startedAt: number, renderCpuMs: number): void {
    const previous = this.previousFrameAt;
    this.previousFrameAt = startedAt;
    if (previous === undefined || startedAt - previous > PAUSE_MS) {
      this.sampleStartedAt = startedAt;
      this.frames = this.renderCpu = 0;
      this.shortestFrame = Number.POSITIVE_INFINITY;
      return;
    }
    this.frames++;
    this.renderCpu += renderCpuMs;
    this.shortestFrame = Math.min(this.shortestFrame, startedAt - previous);
    const elapsed = startedAt - this.sampleStartedAt;
    if (elapsed < SAMPLE_MS) return;
    const interval = elapsed / this.frames;
    const cpuShare = this.renderCpu / this.frames / interval;
    this.periods.push(this.shortestFrame);
    if (this.periods.length > PERIOD_SAMPLES) this.periods.shift();
    const shortest = Math.min(...this.periods);
    this.sampleStartedAt = startedAt;
    this.frames = this.renderCpu = 0;
    this.shortestFrame = Number.POSITIVE_INFINITY;
    this.changed ||= this.evaluate(interval, cpuShare, shortest);
  }

  private evaluate(interval: number, cpuShare: number, shortest: number): boolean {
    const target = Math.max(TARGET_FRAME_MS, this.cappedFrameMs ?? 0);
    this.samplesSinceRaise++;
    if (this.trial) {
      // The first sample after a step includes target allocation; judge the second.
      if (++this.trial.samples < 2) return false;
      const helped = interval <= this.trial.interval * .95;
      this.trial = undefined;
      if (!helped) {
        // Frames limited elsewhere keep the higher resolution for a growing interval.
        // No frame faster than 1.5 target intervals means the display or power mode caps the rate.
        if (shortest >= TARGET_FRAME_MS * 1.5) this.cappedFrameMs = shortest * .97;
        this.level--;
        this.holdSamples = this.holdDuration;
        this.holdDuration = Math.min(this.holdDuration * 2, MAX_HOLD_SAMPLES);
        this.slowSamples = this.steadySamples = 0;
        return true;
      }
      this.holdDuration = HOLD_SAMPLES;
    }
    if (this.holdSamples > 0) this.holdSamples--;
    this.slowSamples = interval > target * SLOW_RATIO && cpuShare < RENDER_CPU_SHARE ? this.slowSamples + 1 : 0;
    this.steadySamples = interval <= target * STEADY_RATIO ? this.steadySamples + 1 : 0;
    if (this.slowSamples >= 2 && this.level < FACTORS.length - 1 && !this.holdSamples) {
      // Dropping right after a raise means the higher step does not fit; wait longer next time.
      if (this.samplesSinceRaise <= 3) this.raiseSamples = Math.min(this.raiseSamples * 2, MAX_RAISE_SAMPLES);
      this.level++;
      this.trial = {interval, samples: 0};
      this.slowSamples = this.steadySamples = 0;
      return true;
    }
    if (this.level > 0 && this.steadySamples >= this.raiseSamples) {
      this.level--;
      this.samplesSinceRaise = 0;
      this.slowSamples = this.steadySamples = 0;
      return true;
    }
    return false;
  }
}
