import {EffectParticleState} from './effect-particle-state';
import {EffectVec3} from '../common/types';
import {EffectNativeMatrix, rotateEffectVector, transformEffectPositionInPlace} from '../common/effect-native-space';

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

/** Native 100-byte particle initialization, with spatial matrices supplied. */
export function initialEffectParticle(config: EffectParticleSpawnConfig, frameCount: number,
  emitterPosition: EffectVec3, orbitOffset: EffectVec3, globalRotation: EffectNativeMatrix,
  random: () => number, parentMatrix?: EffectNativeMatrix): EffectParticleState {
  const scalar = (range: [number, number]): number => effectRandomRange(...range, random());
  const vector = (range: [EffectVec3, EffectVec3]): EffectVec3 =>
    range[0].map((minimum, index) => effectRandomRange(minimum, range[1][index], random())) as EffectVec3;
  const ranges = config.ranges;
  // The original order shares the process RNG with other effects.
  const alpha = scalar(ranges.alpha);
  const lifetime = scalar(ranges.lifetime);
  const scale = scalar(ranges.scale);
  const rgb = vector(ranges.rgb);
  const angleRate = vector(ranges.angleRate);
  let velocity = vector(ranges.velocity);
  let acceleration = vector(ranges.acceleration);
  const angles = vector(ranges.angles);
  const frame = Math.max(0, Math.min(frameCount - 1,
    random() % (ranges.frame[1] - ranges.frame[0] + 1) + ranges.frame[0]));
  let position = emitterPosition.map((value, index) => Math.fround(value + orbitOffset[index])) as EffectVec3;
  if (config.shape === 1) {
    const center = [...position];
    center[0] = Math.fround(emitterPosition[0]) + Math.fround(orbitOffset[0]);
    position = center.map((value, index) => scalar([
      Math.fround(value + config.boxMin[index]), Math.fround(value + config.boxMax[index]),
    ])) as EffectVec3;
  } else if (config.shape === 2) {
    const radius = scalar([0, config.radius]);
    const angle = effectRandomRangeUnstored(0, Math.fround(6.283185307179586), random());
    position = [Math.fround(Math.cos(angle) * radius + position[0]), position[1],
      Math.fround(Math.sin(Math.fround(angle)) * radius + position[2])];
  }
  let visible = true;
  if (parentMatrix) {
    if (parentMatrix.every(value => value === 0)) {
      visible = false;
    } else {
      position = transformEffectPositionInPlace(parentMatrix, position);
      velocity = rotateEffectVector(parentMatrix, velocity);
    }
  } else {
    velocity = rotateEffectVector(globalRotation, velocity);
    acceleration = rotateEffectVector(globalRotation, acceleration);
  }
  return {visible, age: 0, acceleration, velocity, position, angles, angleRate,
    lifetime, scale, color: [rgb[0], rgb[1], rgb[2], alpha], frame, frameRemainder: 0};
}
