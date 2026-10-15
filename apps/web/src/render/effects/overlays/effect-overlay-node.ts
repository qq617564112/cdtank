import {advanceEffectFrame, EffectFrameConfig} from '../common/effect-frame-clock';
import {EffectColor} from '../common/types';
export interface EffectOverlayControl extends EffectFrameConfig {
  baseFlag: number;
  color: EffectColor;
  colorAddRate: EffectColor;
}

/** Original type8 fullscreen overlay state; screen geometry stays external. */
export class EffectOverlayNodeState {
  controller = 0;
  color: EffectColor = [0, 0, 0, 0];
  frame = 0;
  frameRemainder = 0;
  private readonly randomFrame = (count: number): number => this.random() % count;
  constructor(readonly controls: readonly EffectOverlayControl[], private readonly random: () => number) {}

  start(): void {
    this.controller = 0;
    const control = this.controls[0];
    this.frame = control.frameFlags & 2 ? control.frameCount - 1 :
      control.frameFlags & 4 ? this.random() % control.frameCount : 0;
    this.frameRemainder = 0;
    this.color = [...control.color];
  }

  reset(controller: number): void {
    this.controller = controller;
    const control = this.controls[controller];
    if (!control.baseFlag) this.color = [...control.color];
  }

  update(deltaSeconds: number): void {
    const control = this.controls[this.controller];
    const delta = Math.fround(deltaSeconds);
    for (let axis = 0; axis < 4; ++axis) {
      this.color[axis] = Math.fround(this.color[axis] + delta * control.colorAddRate[axis]);
    }
    // The original clamps alpha after each color component.
    this.color[3] = Math.max(0, Math.min(1, this.color[3]));
    advanceEffectFrame(this, control, delta, this.randomFrame);
  }
}
