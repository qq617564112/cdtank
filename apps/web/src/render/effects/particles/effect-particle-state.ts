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

/** Native type-6 modes 0/1/2/3, with target coordinates resolved externally. */
export function advanceEffectParticle(state: EffectParticleState, config: EffectParticleUpdateConfig,
  deltaSeconds: number, randomFrame: (count: number) => number,
  resolvedTarget?: EffectVec3): EffectParticleState {
  const mode = config.motion.mode;
  if ((mode === 1 || mode === 2) && !resolvedTarget) {
    throw new Error('Original particle motion requires a resolved target');
  }
  const delta = Math.fround(deltaSeconds);
  const addRate = (value: number, rate: number): number =>
    Math.fround(value + Math.fround(Math.fround(rate) * delta));
  let acceleration: EffectVec3 = [...state.acceleration];
  let velocity: EffectVec3 = [...state.velocity];
  let position: EffectVec3;
  if ((mode === 1 || mode === 2) && resolvedTarget) {
    const difference = resolvedTarget.map((value, index) => Math.fround(value - state.position[index])) as EffectVec3;
    if (mode === 1) {
      const direction = normalizeEffectVector(difference);
      const [x, y, z] = state.velocity;
      const speed = Math.sqrt(x * x + y * y + z * z) * (state.age / state.lifetime);
      position = state.position.map((value, index) => {
        const rate = direction[index] * speed;
        // X retains the rate in x87; Y stores rate, Z also stores rate × delta.
        const product = index === 0 ? rate * delta : Math.fround(rate) * delta;
        return Math.fround(value + (index === 2 ? Math.fround(product) : product));
      }) as EffectVec3;
    } else {
      const force = difference.map((value, index) => Math.fround(-value - state.velocity[index])) as EffectVec3;
      const [x, y, z] = force;
      const magnitude = Math.fround(Math.sqrt(x * x + y * y + z * z));
      const direction = normalizeEffectVector(force);
      acceleration = direction.map(value => Math.fround(value * magnitude)) as EffectVec3;
      velocity = state.velocity.map((value, index) => addRate(value, acceleration[index])) as EffectVec3;
      position = state.position.map((value, index) => addRate(value, velocity[index])) as EffectVec3;
    }
  } else {
    if (mode === 3) {
      acceleration = state.acceleration.map((value, index) => addRate(value, config.motion.acceleration[index])) as EffectVec3;
    }
    velocity = state.velocity.map((value, index) => addRate(value, acceleration[index])) as EffectVec3;
    position = state.position.map((value, index) => addRate(value, velocity[index])) as EffectVec3;
  }
  const angles = state.angles.map((value, index) => addRate(value, state.angleRate[index])) as EffectVec3;
  const frame = advanceEffectFrame({frame: state.frame, remainder: state.frameRemainder},
    config.frame, delta, randomFrame);
  const color: EffectColor = [...state.color];
  if (config.alphaMode === 1 || config.alphaMode === 2) {
    const step = delta / Math.fround(state.lifetime);
    color[3] = Math.max(0, Math.min(1, Math.fround(state.color[3] +
      (config.alphaMode === 1 ? -step : step))));
  }
  return {...state, acceleration, velocity, position, angles, color,
    frame: frame.frame, frameRemainder: frame.remainder};
}
