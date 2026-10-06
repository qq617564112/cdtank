import {EffectEmitterClock, EffectEmitterConfig} from './effect-emitter-clock';
import {advanceEffectEmitterSpace, EffectEmitterSpace, EffectEmitterSpaceControl, resetEffectEmitterSpace, startEffectEmitterSpace} from './effect-emitter-space';
import {EffectNativeMatrix, transformEffectPositionInPlace} from '../common/effect-native-space';
import {EffectParticlePool} from './effect-particle-pool';
import {EffectParticleSpawnConfig, initialEffectParticle} from './effect-particle-spawn';
import {advanceEffectParticle, EffectParticleState, EffectParticleUpdateConfig} from './effect-particle-state';
import {EffectPathClock} from '../common/effect-path-clock';
import type {EffectVec3} from '../common/types';

export interface EffectParticleController extends EffectEmitterSpaceControl {
  emitter: EffectEmitterConfig;
  spawn: EffectParticleSpawnConfig;
  particleMotion: EffectParticleUpdateConfig['motion'];
  particleFrame: EffectParticleUpdateConfig['frame'];
  alphaMode: number;
}

/** Original type6 spatial/emission/particle order; lifecycle dispatch stays external. */
export class EffectParticleNodeState {
  readonly emitter: EffectEmitterClock;
  readonly pool: EffectParticlePool<EffectParticleState>;
  controller = 0;
  origin: EffectVec3 = [0, 0, 0];

  constructor(readonly controls: readonly EffectParticleController[],
    readonly spaces: EffectEmitterSpace[], readonly paths: readonly (EffectPathClock | undefined)[],
    capacity: number, private readonly random: () => number,
    readonly globalRotation: EffectNativeMatrix, readonly parentMatrix?: EffectNativeMatrix) {
    this.emitter = new EffectEmitterClock((minimum, maximum) =>
      minimum + random() % (maximum - minimum + 1));
    this.pool = new EffectParticlePool(capacity, state => structuredClone(state));
  }

  start(origin: EffectVec3): void {
    this.controller = 0;
    this.origin = origin.map(Math.fround) as EffectVec3;
    this.emitter.fraction = 0;
    this.emitter.burstEmitted = false;
    this.spaces[0] = startEffectEmitterSpace(this.controls[0], this.origin,
      this.globalRotation, this.parentMatrix !== undefined, this.spaces[0].orbitOffset);
    this.initializePath(0);
  }

  reset(controller: number): void {
    this.controller = controller;
    this.spaces[controller] = resetEffectEmitterSpace(this.spaces[controller - 1],
      this.spaces[controller].orbitOffset, this.controls[controller]);
    this.initializePath(controller);
  }

  update(elapsed: number, deltaSeconds: number, resolvedTarget?: EffectVec3): void {
    const index = this.controller;
    const control = this.controls[index];
    const path = this.paths[index];
    const space = advanceEffectEmitterSpace(this.spaces[index], control, elapsed, deltaSeconds,
      this.globalRotation, this.parentMatrix !== undefined,
      path ? {clock: path, origin: this.origin} : undefined);
    this.spaces[index] = space;
    let target = resolvedTarget;
    if (!target && (control.particleMotion.mode === 1 || control.particleMotion.mode === 2)) {
      target = space.position.map((value, axis) =>
        Math.fround(value + space.orbitOffset[axis])) as EffectVec3;
      if (this.parentMatrix) target = transformEffectPositionInPlace(this.parentMatrix, target);
    }
    this.pool.emit(this.emitter.advance(deltaSeconds, control.emitter), () =>
      initialEffectParticle(control.spawn, control.particleFrame.frameCount,
        space.position, space.orbitOffset, this.globalRotation, this.random, this.parentMatrix));
    this.pool.update(deltaSeconds, (state, delta) => advanceEffectParticle(state,
      {motion: control.particleMotion, frame: control.particleFrame, alphaMode: control.alphaMode},
      delta, count => this.random() % count, target));
  }

  /** Original vtable+0x2c clears particles and prevents another burst. */
  end(): void {
    this.pool.clear();
    this.emitter.fraction = 0;
    this.emitter.burstEmitted = true;
  }

  private initializePath(index: number): void {
    const path = this.paths[index];
    if (!path) return;
    path.reset();
    this.spaces[index] = {position: path.advance(0).map((value, axis) =>
      Math.fround(value + this.origin[axis])) as EffectVec3, orbitOffset: [0, 0, 0]};
  }
}
