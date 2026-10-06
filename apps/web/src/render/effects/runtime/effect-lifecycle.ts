import {EffectTimelineConfig, effectHasStarted, effectLifetimeEnded,
  selectEffectController} from './effect-timeline';

export interface EffectLifecycleHooks {
  start(node: EffectNodeLifecycle): void;
  activate(node: EffectNodeLifecycle): void;
  reset(node: EffectNodeLifecycle, controller: number): void;
  update(node: EffectNodeLifecycle, delta: number): void;
  end(node: EffectNodeLifecycle): void;
  release(node: EffectNodeLifecycle): void;
  additionalEnd(node: EffectNodeLifecycle, lifetimeEnded: boolean): boolean;
}

/** State dispatch from 0x47f61c; callbacks supply type-specific native behavior. */
export class EffectNodeLifecycle {
  phase: 0 | 1 | 2 | 3 = 0;
  elapsed = 0;
  controller = 0;
  readonly children: EffectNodeLifecycle[] = [];
  parent?: EffectNodeLifecycle;

  constructor(readonly timing: EffectTimelineConfig,
    private readonly hooks: EffectLifecycleHooks, readonly retainWhenEnded = false) {}

  attach(child: EffectNodeLifecycle): void {
    this.children.push(child);
    child.parent = this;
  }

  start(): void {
    this.elapsed = 0;
    this.controller = 0;
    this.phase = 1;
    this.hooks.start(this);
  }

  /** Original explicit end 47f3c4 ends children from last to first. */
  stop(): void {
    this.phase = 3;
    this.hooks.end(this);
    this.elapsed = 0;
    for (let index = this.children.length - 1; index >= 0; --index) this.children[index].stop();
    if (this.children.length === 0 && !this.retainWhenEnded) this.release();
  }

  tick(deltaSeconds: number): void {
    if (this.phase === 0) return;
    const delta = Math.fround(deltaSeconds);
    this.elapsed = Math.fround(this.elapsed + delta);
    if (this.phase === 1) {
      if (!effectHasStarted(this.elapsed, this.timing.delay)) return;
      this.phase = 2;
      this.hooks.activate(this);
      for (let index = this.children.length - 1; index >= 0; --index) {
        this.children[index].start();
      }
      this.tickActive(Math.fround(this.elapsed - Math.fround(this.timing.delay)));
    } else if (this.phase === 2) {
      this.tickActive(delta);
    } else if (this.children.length === 0) {
      if (!this.retainWhenEnded) this.release();
    } else {
      this.tickChildren(delta);
    }
  }

  private tickActive(delta: number): void {
    const selection = selectEffectController(this.elapsed, this.timing, this.controller);
    for (const controller of selection.resetIndices) {
      this.controller = controller;
      this.hooks.reset(this, controller);
    }
    this.controller = selection.index;
    if (this.controller >= 0) {
      const lifetimeEnded = effectLifetimeEnded(this.elapsed, this.timing.delay, this.timing.lifetime);
      const additionalEnded = this.hooks.additionalEnd(this, lifetimeEnded);
      if (lifetimeEnded || additionalEnded) {
        this.phase = 3;
        this.hooks.end(this);
      } else {
        this.hooks.update(this, delta);
      }
    }
    this.tickChildren(delta);
  }

  private tickChildren(delta: number): void {
    for (let index = this.children.length - 1; index >= 0; --index) {
      this.children[index].tick(delta);
    }
  }

  private release(): void {
    this.phase = 0;
    this.elapsed = 0;
    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      this.parent.children.splice(index, 1);
      this.parent = undefined;
    }
    this.hooks.release(this);
  }
}
