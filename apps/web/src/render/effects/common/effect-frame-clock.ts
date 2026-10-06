/** Original type-1 sprite clock, from 0x482992 and 0x4830e1–0x483161. */
export interface EffectFrameConfig {
  frameCount: number;
  frameInterval: number;
  frameFlags: number;
}

export class EffectFrameClock {
  frame = 0;
  remainder = 0;

  constructor(
    private readonly config: EffectFrameConfig,
    private readonly randomFrame: (count: number) => number,
  ) {
    if (!Number.isInteger(config.frameCount) || config.frameCount < 1 ||
        !Number.isFinite(config.frameInterval) || config.frameInterval <= 0) {
      throw new Error('Invalid original sprite frame configuration');
    }
    this.reset();
  }

  reset(): void {
    const {frameFlags, frameCount} = this.config;
    // Initialization tests reverse before random. Update tests random first.
    this.frame = frameFlags & 2 ? frameCount - 1 :
        frameFlags & 4 ? this.randomFrame(frameCount) : 0;
    this.remainder = 0;
  }

  advance(deltaSeconds: number): number {
    const state = advanceEffectFrame({frame: this.frame, remainder: this.remainder},
      this.config, deltaSeconds, this.randomFrame);
    this.frame = state.frame;
    this.remainder = state.remainder;
    return this.frame;
  }
}

export interface EffectFrameState {
  frame: number;
  remainder: number;
}

/** Advance an existing instance without initialization or an extra RNG draw. */
export function advanceEffectFrame(previous: EffectFrameState, config: EffectFrameConfig,
  deltaSeconds: number, randomFrame: (count: number) => number): EffectFrameState {
  const state = {...previous};
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new Error('Invalid sprite update delta');
  }
  const {frameCount, frameFlags} = config;
  const interval = Math.fround(config.frameInterval);
  // Original x87 adds f32 inputs, compares the sum, then stores f32.
  const accumulated = state.remainder + Math.fround(deltaSeconds);
  if (accumulated < interval) {
    state.remainder = Math.fround(accumulated);
    return state;
  }
  state.remainder = Math.fround(accumulated - interval);
  // One step per update, including updates with a remainder >= interval.
  if (frameFlags & 4) {
    state.frame = randomFrame(frameCount);
  } else if (frameFlags & 2) {
    --state.frame;
    if (state.frame < 0) {
      state.frame = frameFlags & 1 ? 0 : frameCount - 1;
    }
  } else {
    ++state.frame;
    if (state.frame >= frameCount) {
      state.frame = frameFlags & 1 ? frameCount - 1 : 0;
    }
  }
  return state;
}
