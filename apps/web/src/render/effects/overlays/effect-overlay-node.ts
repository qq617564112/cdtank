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
    this.color = this.color.map((value, axis) => Math.fround(value + delta * control.colorAddRate[axis])) as EffectColor;
    // The original clamps alpha after each color component.
    this.color[3] = Math.max(0, Math.min(1, this.color[3]));
    const frame = advanceEffectFrame({frame: this.frame, remainder: this.frameRemainder},
      control, delta, count => this.random() % count);
    this.frame = frame.frame;
    this.frameRemainder = frame.remainder;
  }
}
