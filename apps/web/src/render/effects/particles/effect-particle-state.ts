import {advanceEffectFrame, EffectFrameConfig} from '../common/effect-frame-clock';
import {normalizeEffectVector} from '../common/effect-native-space';
import {EffectColor, EffectVec3} from '../common/types';

export interface EffectParticleState {
  visible: boolean;
  age: number;
  acceleration: EffectVec3;
  velocity: EffectVec3;
  position: EffectVec3;
  angles: EffectVec3;
  angleRate: EffectVec3;
  lifetime: number;
  scale: number;
  color: EffectColor;
  frame: number;
  frameRemainder: number;
}

export interface EffectParticleUpdateConfig {
  motion: {mode: number; acceleration: EffectVec3};
  frame: EffectFrameConfig;
  alphaMode: number;
}

/** Advance the retained native type-6 particle; target coordinates are resolved externally. */
export function advanceEffectParticle(state: EffectParticleState, config: EffectParticleUpdateConfig,
  deltaSeconds: number, randomFrame: (count: number) => number,
  resolvedTarget?: EffectVec3): EffectParticleState {
  const mode = config.motion.mode;
  if ((mode === 1 || mode === 2) && !resolvedTarget) {
    throw new Error('Original particle motion requires a resolved target');
  }
  const delta = Math.fround(deltaSeconds);
  const {acceleration, velocity, position, angles, color} = state;
  if ((mode === 1 || mode === 2) && resolvedTarget) {
    const difference = resolvedTarget.map((value, index) => Math.fround(value - state.position[index])) as EffectVec3;
    if (mode === 1) {
      const direction = normalizeEffectVector(difference);
      const [x, y, z] = state.velocity;
      const speed = Math.sqrt(x * x + y * y + z * z) * (state.age / state.lifetime);
      for (let index = 0; index < 3; index++) {
        const rate = direction[index] * speed;
        // X retains the rate in x87; Y stores rate, Z also stores rate × delta.
        const product = index === 0 ? rate * delta : Math.fround(rate) * delta;
        position[index] = Math.fround(position[index] + (index === 2 ? Math.fround(product) : product));
      }
    } else {
      const force = difference.map((value, index) => Math.fround(-value - state.velocity[index])) as EffectVec3;
      const [x, y, z] = force;
      const magnitude = Math.fround(Math.sqrt(x * x + y * y + z * z));
      const direction = normalizeEffectVector(force);
      for (let index = 0; index < 3; index++) {
        acceleration[index] = Math.fround(direction[index] * magnitude);
        velocity[index] = Math.fround(velocity[index] + Math.fround(Math.fround(acceleration[index]) * delta));
        position[index] = Math.fround(position[index] + Math.fround(Math.fround(velocity[index]) * delta));
      }
    }
  } else {
    for (let index = 0; index < 3; index++) {
      if (mode === 3) {
        acceleration[index] = Math.fround(acceleration[index] +
          Math.fround(Math.fround(config.motion.acceleration[index]) * delta));
      }
      velocity[index] = Math.fround(velocity[index] + Math.fround(Math.fround(acceleration[index]) * delta));
      position[index] = Math.fround(position[index] + Math.fround(Math.fround(velocity[index]) * delta));
    }
  }
  for (let index = 0; index < 3; index++) {
    angles[index] = Math.fround(angles[index] + Math.fround(Math.fround(state.angleRate[index]) * delta));
  }
  const frame = advanceEffectFrame({frame: state.frame, remainder: state.frameRemainder},
    config.frame, delta, randomFrame);
  if (config.alphaMode === 1 || config.alphaMode === 2) {
    const step = delta / Math.fround(state.lifetime);
    color[3] = Math.max(0, Math.min(1, Math.fround(state.color[3] +
      (config.alphaMode === 1 ? -step : step))));
  }
  state.frame = frame.frame;
  state.frameRemainder = frame.remainder;
  return state;
}
