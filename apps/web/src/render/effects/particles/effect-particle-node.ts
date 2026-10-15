import {EffectEmitterClock, EffectEmitterConfig} from './effect-emitter-clock';
import {advanceEffectEmitterSpaceToRef, EffectEmitterSpace, EffectEmitterSpaceControl, resetEffectEmitterSpaceToRef, startEffectEmitterSpaceToRef} from './effect-emitter-space';
import {EffectNativeMatrix, transformEffectPositionInPlaceToRef} from '../common/effect-native-space';
import {EffectParticlePool} from './effect-particle-pool';
import {EffectParticleSpawnConfig, initialEffectParticle, initialEffectParticleToRef} from './effect-particle-spawn';
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
  private readonly particleConfig: EffectParticleUpdateConfig;
  private readonly pathSpaces?: ({clock: EffectPathClock; origin: EffectVec3} | undefined)[];
  private readonly emitterVelocity: EffectVec3 = [0, 0, 0];
  private readonly targetPosition: EffectVec3 = [0, 0, 0];
  private readonly randomFrame = (count: number): number => this.random() % count;
  private target?: EffectVec3;
  private readonly advanceParticle = (state: EffectParticleState, delta: number): EffectParticleState =>
    advanceEffectParticle(state, this.particleConfig, delta, this.randomFrame, this.target);
  private readonly spawnParticle = (recycled?: EffectParticleState): EffectParticleState => {
    const control = this.controls[this.controller], space = this.spaces[this.controller];
    if (recycled) return initialEffectParticleToRef(control.spawn, control.particleFrame.frameCount,
      space.position, space.orbitOffset, this.globalRotation, this.random, recycled, this.parentMatrix);
    return initialEffectParticle(control.spawn, control.particleFrame.frameCount,
      space.position, space.orbitOffset, this.globalRotation, this.random, this.parentMatrix);
  };

  constructor(readonly controls: readonly EffectParticleController[],
    readonly spaces: EffectEmitterSpace[], readonly paths: readonly (EffectPathClock | undefined)[] | undefined,
    capacity: number, private readonly random: () => number,
    readonly globalRotation: EffectNativeMatrix, readonly parentMatrix?: EffectNativeMatrix,
    private readonly emissionScale = 1) {
    this.emitter = new EffectEmitterClock((minimum, maximum) =>
      minimum + random() % (maximum - minimum + 1));
    this.pool = new EffectParticlePool(Math.ceil(capacity * emissionScale));
    this.pathSpaces = paths?.map(clock => clock ? {clock, origin: this.origin} : undefined);
    const control = controls[0];
    this.particleConfig = {
      motion: control.particleMotion, frame: control.particleFrame, alphaMode: control.alphaMode,
    };
  }

  start(origin: EffectVec3): void {
    this.controller = 0;
    this.selectParticleConfig(this.controls[0]);
    for (let axis = 0; axis < 3; axis++) this.origin[axis] = Math.fround(origin[axis]);
    this.emitter.fraction = 0;
    this.emitter.burstEmitted = false;
    startEffectEmitterSpaceToRef(this.controls[0], this.origin,
      this.globalRotation, this.parentMatrix !== undefined,
      this.spaces[0].orbitOffset, this.spaces[0], this.emitterVelocity);
    this.initializePath(0);
  }

  reset(controller: number): void {
    this.controller = controller;
    this.selectParticleConfig(this.controls[controller]);
    resetEffectEmitterSpaceToRef(this.spaces[controller - 1],
      this.spaces[controller].orbitOffset, this.controls[controller],
      this.spaces[controller], this.emitterVelocity);
    this.initializePath(controller);
  }

  update(elapsed: number, deltaSeconds: number, resolvedTarget?: EffectVec3): void {
    const index = this.controller;
    const control = this.controls[index];
    const space = this.spaces[index];
    advanceEffectEmitterSpaceToRef(space, control, elapsed, deltaSeconds,
      this.globalRotation, this.parentMatrix !== undefined, space, this.emitterVelocity, this.pathSpaces?.[index]);
    let target = resolvedTarget;
    if (!target && (control.particleMotion.mode === 1 || control.particleMotion.mode === 2)) {
      target = this.targetPosition;
      for (let axis = 0; axis < 3; axis++) target[axis] = Math.fround(space.position[axis] + space.orbitOffset[axis]);
      if (this.parentMatrix) transformEffectPositionInPlaceToRef(this.parentMatrix, target, target);
    }
    this.pool.emit(this.emitter.advance(deltaSeconds, control.emitter, this.emissionScale), this.spawnParticle);
    this.target = target;
    this.pool.update(deltaSeconds, this.advanceParticle);
  }

  /** Original vtable+0x2c clears particles and prevents another burst. */
  end(): void {
    this.pool.clear();
    this.emitter.fraction = 0;
    this.emitter.burstEmitted = true;
  }

  private selectParticleConfig(control: EffectParticleController): void {
    this.particleConfig.motion = control.particleMotion;
    this.particleConfig.frame = control.particleFrame;
    this.particleConfig.alphaMode = control.alphaMode;
  }

  private initializePath(index: number): void {
    const path = this.paths?.[index];
    if (!path) return;
    path.reset();
    const space = this.spaces[index];
    path.advanceToRef(0, space.position);
    for (let axis = 0; axis < 3; axis++) {
      space.position[axis] = Math.fround(space.position[axis] + this.origin[axis]);
      space.orbitOffset[axis] = 0;
    }
  }
}
