import {EffectActionEvent, effectActorTimeStep, queryEffectActionEventsToRef} from './effect-action-events';

/** Original immediate GotoAction(id, flags) uses start=1 and end=0. */
export class EffectActorActionClock {
  time = 1;
  overMessage = 0x6f766572;

  constructor(readonly duration: number, readonly events: readonly EffectActionEvent[],
    readonly stopAtEnd: boolean, readonly timeScale: number, readonly precision: 53 | 64) {}

  advance(deltaSeconds: number): number[] {
    const messages: number[] = [];
    this.advanceToRef(deltaSeconds, messages);
    return messages;
  }

  advanceToRef(deltaSeconds: number, messages: number[]): void {
    messages.length = 0;
    const previous = this.time;
    this.time = (this.time + effectActorTimeStep(deltaSeconds, this.timeScale, this.precision)) >>> 0;
    let message = 0;
    if (this.stopAtEnd && this.time >= this.duration) {
      this.time = (this.duration - 100) >>> 0;
      message = this.overMessage;
      this.overMessage = 0;
    }
    // Update sends the explicit completion message before querying timed events.
    if (message !== 0) {
      messages.push(message);
      return;
    }
    if (this.time === previous) return;
    queryEffectActionEventsToRef(this.duration, this.events, previous, this.time, messages);
  }
}
