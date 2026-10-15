import {EffectParticleState} from './effect-particle-state';
import {EffectVec3} from '../common/types';
import {EffectNativeMatrix, rotateEffectVectorToRef, transformEffectPositionInPlaceToRef} from '../common/effect-native-space';

export interface EffectParticleSpawnConfig {
  shape: number;
  boxMin: EffectVec3;
  boxMax: EffectVec3;
  radius: number;
  ranges: {
    angles: [EffectVec3, EffectVec3];
    acceleration: [EffectVec3, EffectVec3];
    velocity: [EffectVec3, EffectVec3];
    angleRate: [EffectVec3, EffectVec3];
    lifetime: [number, number];
    scale: [number, number];
    rgb: [EffectVec3, EffectVec3];
    alpha: [number, number];
    frame: [number, number];
  };
}

/** Float range helper 0x45589c, using original CRT rand() values 0–32767. */
function effectRandomRangeUnstored(minimum: number, maximum: number, randomValue: number): number {
  const width = Math.fround(Math.fround(maximum) - Math.fround(minimum));
  const unit = Math.fround(3.0518509447574615e-5);
  return (randomValue * width) * unit + Math.fround(minimum);
}

export function effectRandomRange(minimum: number, maximum: number, randomValue: number): number {
  return Math.fround(effectRandomRangeUnstored(minimum, maximum, randomValue));
}

function randomVectorRangeToRef(range: [EffectVec3, EffectVec3], random: () => number,
  result: EffectVec3): void {
  result[0] = effectRandomRange(range[0][0], range[1][0], random());
  result[1] = effectRandomRange(range[0][1], range[1][1], random());
  result[2] = effectRandomRange(range[0][2], range[1][2], random());
}

function isZero(value: number): boolean {return value === 0;}

/** Native 100-byte particle initialization, with spatial matrices supplied. */
export function initialEffectParticle(config: EffectParticleSpawnConfig, frameCount: number,
  emitterPosition: EffectVec3, orbitOffset: EffectVec3, globalRotation: EffectNativeMatrix,
  random: () => number, parentMatrix?: EffectNativeMatrix): EffectParticleState {
  return initialEffectParticleToRef(config, frameCount, emitterPosition, orbitOffset,
    globalRotation, random, {visible: true, age: 0, acceleration: [0, 0, 0], velocity: [0, 0, 0],
      position: [0, 0, 0], angles: [0, 0, 0], angleRate: [0, 0, 0],
      lifetime: 0, scale: 0, color: [0, 0, 0, 0], frame: 0, frameRemainder: 0}, parentMatrix);
}

/** Overwrite an expired particle owned by this emitter, preserving RNG order. */
export function initialEffectParticleToRef(config: EffectParticleSpawnConfig, frameCount: number,
  emitterPosition: EffectVec3, orbitOffset: EffectVec3, globalRotation: EffectNativeMatrix,
  random: () => number, result: EffectParticleState, parentMatrix?: EffectNativeMatrix): EffectParticleState {
  const ranges = config.ranges;
  // The original order shares the process RNG with other effects.
  const alpha = effectRandomRange(ranges.alpha[0], ranges.alpha[1], random());
  const lifetime = effectRandomRange(ranges.lifetime[0], ranges.lifetime[1], random());
  const scale = effectRandomRange(ranges.scale[0], ranges.scale[1], random());
  const {color, angleRate, velocity, acceleration, angles, position} = result;
  color[0] = effectRandomRange(ranges.rgb[0][0], ranges.rgb[1][0], random());
  color[1] = effectRandomRange(ranges.rgb[0][1], ranges.rgb[1][1], random());
  color[2] = effectRandomRange(ranges.rgb[0][2], ranges.rgb[1][2], random());
  color[3] = alpha;
  randomVectorRangeToRef(ranges.angleRate, random, angleRate);
  randomVectorRangeToRef(ranges.velocity, random, velocity);
  randomVectorRangeToRef(ranges.acceleration, random, acceleration);
  randomVectorRangeToRef(ranges.angles, random, angles);
  const frame = Math.max(0, Math.min(frameCount - 1,
    random() % (ranges.frame[1] - ranges.frame[0] + 1) + ranges.frame[0]));
  position[0] = Math.fround(emitterPosition[0] + orbitOffset[0]);
  position[1] = Math.fround(emitterPosition[1] + orbitOffset[1]);
  position[2] = Math.fround(emitterPosition[2] + orbitOffset[2]);
  if (config.shape === 1) {
    position[0] = Math.fround(emitterPosition[0]) + Math.fround(orbitOffset[0]);
    for (let axis = 0; axis < 3; axis++) {
      const center = position[axis];
      position[axis] = effectRandomRange(Math.fround(center + config.boxMin[axis]),
        Math.fround(center + config.boxMax[axis]), random());
    }
  } else if (config.shape === 2) {
    const radius = effectRandomRange(0, config.radius, random());
    const angle = effectRandomRangeUnstored(0, Math.fround(6.283185307179586), random());
    position[0] = Math.fround(Math.cos(angle) * radius + position[0]);
    position[2] = Math.fround(Math.sin(Math.fround(angle)) * radius + position[2]);
  }
  let visible = true;
  if (parentMatrix) {
    if (parentMatrix.every(isZero)) {
      visible = false;
    } else {
      transformEffectPositionInPlaceToRef(parentMatrix, position, position);
      rotateEffectVectorToRef(parentMatrix, velocity, velocity);
    }
  } else {
    rotateEffectVectorToRef(globalRotation, velocity, velocity);
    rotateEffectVectorToRef(globalRotation, acceleration, acceleration);
  }
  result.visible = visible;
  result.age = 0;
  result.lifetime = lifetime;
  result.scale = scale;
  result.frame = frame;
  result.frameRemainder = 0;
  return result;
}
