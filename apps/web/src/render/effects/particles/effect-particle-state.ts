import {advanceEffectFrame, EffectFrameConfig} from '../common/effect-frame-clock';
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
    let dx = Math.fround(resolvedTarget[0] - position[0]);
    let dy = Math.fround(resolvedTarget[1] - position[1]);
    let dz = Math.fround(resolvedTarget[2] - position[2]);
    if (mode === 2) {
      dx = Math.fround(-dx - velocity[0]);
      dy = Math.fround(-dy - velocity[1]);
      dz = Math.fround(-dz - velocity[2]);
    }
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const magnitude = Math.fround(length);
    if (length < Math.fround(.005)) {
      dx = 0; dy = 1; dz = 0;
    } else {
      const inverse = 1 / magnitude;
      dx = Math.fround(dx * inverse);
      dy = Math.fround(dy * inverse);
      dz = Math.fround(dz * inverse);
    }
    if (mode === 1) {
      const [x, y, z] = state.velocity;
      const speed = Math.sqrt(x * x + y * y + z * z) * (state.age / state.lifetime);
      for (let index = 0; index < 3; index++) {
        const rate = (index === 0 ? dx : index === 1 ? dy : dz) * speed;
        // X retains the rate in x87; Y stores rate, Z also stores rate × delta.
        const product = index === 0 ? rate * delta : Math.fround(rate) * delta;
        position[index] = Math.fround(position[index] + (index === 2 ? Math.fround(product) : product));
      }
    } else {
      for (let index = 0; index < 3; index++) {
        acceleration[index] = Math.fround((index === 0 ? dx : index === 1 ? dy : dz) * magnitude);
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
  advanceEffectFrame(state, config.frame, delta, randomFrame);
  if (config.alphaMode === 1 || config.alphaMode === 2) {
    const step = delta / Math.fround(state.lifetime);
    color[3] = Math.max(0, Math.min(1, Math.fround(state.color[3] +
      (config.alphaMode === 1 ? -step : step))));
  }
  return state;
}
