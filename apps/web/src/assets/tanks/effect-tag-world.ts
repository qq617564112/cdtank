import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {EffectVec3} from '../../render/effects/common/types';

export interface EffectTagWorldPose {
  readonly position: EffectVec3;
  readonly yaw: number;
  readonly turretYaw: number;
  readonly pivot: readonly [number, number];
}

// Original +Z / 180 degree quaternion setup retains this nonzero cosine.
const twiceW = 2 * Math.fround(1.2167964413833943e-8);
const correction = [-1, twiceW, 0, 0, -twiceW, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Original primary tag world composition; angles are native degrees. */
export class EffectTagWorldComposer {
  private readonly local = new Array<number>(16);
  private readonly world = new Array<number>(16);
  private readonly transformed = new Array<number>(16);

  /** Output may reuse the input storage; scratch matrices belong to this composer. */
  composeToRef(local: EffectNativeMatrix, pose: EffectTagWorldPose,
    useTurret: boolean, result: number[]): void {
    let zero = true;
    for (let index = 0; index < 16; ++index) if (local[index] !== 0) {zero = false; break;}
    if (zero) {
      for (let index = 0; index < 16; ++index) result[index] = local[index];
      return;
    }
    const degrees = Math.fround(useTurret ? pose.turretYaw : pose.yaw);
    const angle = degrees * Math.fround(.01745329238474369);
    const cosine = Math.fround(Math.cos(angle));
    const sine = Math.fround(Math.sin(Math.fround(angle)));
    const {world, transformed} = this;
    world.fill(0);
    world[0] = world[10] = cosine; world[2] = -sine; world[8] = sine;
    world[5] = world[15] = 1;
    world[12] = useTurret ? Math.fround(pose.pivot[0]) : 0;
    world[14] = useTurret ? Math.fround(pose.pivot[1]) : 0;
    for (let index = 0; index < 16; ++index) this.local[index] = Math.fround(local[index]);
    multiplyRowsToRef(this.local, world, transformed);
    for (let index = 0; index < 3; ++index) {
      transformed[12 + index] = Math.fround(transformed[12 + index] + Math.fround(pose.position[index]));
    }
    multiplyRowsToRef(correction, transformed, result);
  }
}

function multiplyRowsToRef(first: readonly number[], second: readonly number[], result: number[]): void {
  for (let row = 0; row < 4; ++row) {
    for (let column = 0; column < 4; ++column) {
      result[row * 4 + column] = Math.fround(((first[row * 4] * second[column] +
        first[row * 4 + 1] * second[4 + column]) +
        first[row * 4 + 2] * second[8 + column]) +
        first[row * 4 + 3] * second[12 + column]);
    }
  }
}
