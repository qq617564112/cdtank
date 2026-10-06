import {EffectNativeMatrix} from '../common/effect-native-space';
import {EFFECT_IDENTITY, multiplyEffectMatrices} from '../common/effect-render-transform';

export interface EffectModelTrack {mode: number; keys: number[][];}
export interface EffectModelAnimationNode {
  position: EffectModelTrack;
  rotation: EffectModelTrack;
  scale: EffectModelTrack;
  value: number;
}

/** gbGfxManager::GetDeltaTime preserves f64 delta below .5, otherwise returns .1. */
export function effectModelEngineDelta(deltaSeconds: number): number {
  return deltaSeconds < .5 ? deltaSeconds : .1;
}

/** Original gbGeomNode clock and source mode-3 CVD transform tracks. */
export class EffectModelAnimation {
  time = 0;
  loops = 0;
  rate = 1;
  matrix: EffectNativeMatrix = [...EFFECT_IDENTITY];
  constructor(readonly node: EffectModelAnimationNode, readonly duration: number) {}

  setTime(time: number): void {this.time = Math.fround(time); this.loops = 0;}
  setRate(rate: number): void {this.rate = Math.fround(rate);}

  update(deltaSeconds: number): void {
    this.time += Math.fround(deltaSeconds * this.rate);
    if (this.duration > 0) {
      while (this.time > this.duration) {this.time -= this.duration; ++this.loops;}
    }
    const time = Math.fround(this.time);
    const position = vector(this.node.position, time);
    const rotation = quaternion(this.node.rotation, time);
    const scale = vector(this.node.scale, time);
    const scaleRotation = quaternion({...this.node.scale,
      keys: this.node.scale.keys.map(key => [key[0], key[1], ...key.slice(5, 9)])}, time);
    const uniform = new DataView(new ArrayBuffer(4));
    uniform.setUint32(0, this.node.value, true);
    let matrix = [...EFFECT_IDENTITY];
    matrix[12] = position[0]; matrix[13] = position[1]; matrix[14] = position[2];
    const amount = uniform.getFloat32(0, true);
    matrix = multiplyEffectMatrices(matrix, [amount,0,0,0,0,amount,0,0,0,0,amount,0,0,0,0,1]);
    matrix = multiplyEffectMatrices(matrix, quaternionMatrix([rotation[0], rotation[1], rotation[2], -rotation[3]]));
    matrix = multiplyEffectMatrices(matrix, quaternionMatrix([scaleRotation[0], scaleRotation[1], scaleRotation[2], -scaleRotation[3]]));
    matrix = multiplyEffectMatrices(matrix, [scale[0],0,0,0,0,scale[1],0,0,0,0,scale[2],0,0,0,0,1]);
    matrix = multiplyEffectMatrices(matrix, quaternionMatrix(scaleRotation));
    this.matrix = matrix;
  }
}

function interval(track: EffectModelTrack, time: number): [number[], number[], number] {
  if (track.mode !== 3) throw new Error(`Unrecovered CVD track mode ${track.mode}`);
  const origin = track.keys[0][0];
  const last = track.keys[track.keys.length - 1];
  if (track.keys.length === 1 || time >= Math.fround(last[0] - origin)) return [last, last, 0];
  let index = 0;
  while (index + 1 < track.keys.length - 1 && Math.fround(track.keys[index + 1][0] - origin) <= time) ++index;
  const first = track.keys[index], second = track.keys[index + 1];
  const start = Math.fround(first[0] - origin), end = Math.fround(second[0] - origin);
  return [first, second, (time - start) / (end - start)];
}

function vector(track: EffectModelTrack, time: number): number[] {
  const [first, second, fraction] = interval(track, time);
  return [2,3,4].map(index => Math.fround((1 - fraction) * first[index] + fraction * second[index]));
}

function quaternion(track: EffectModelTrack, time: number): number[] {
  const [first, second, rawFraction] = interval(track, time);
  const fraction = Math.fround(rawFraction);
  const left = first.slice(2, 6);
  let right = second.slice(2, 6);
  let dot = left[3] * right[3] + left[2] * right[2] + left[0] * right[0] + left[1] * right[1];
  if (dot < 0) {dot = -dot; right = right.map(value => -value);}
  let a = Math.fround(1 - fraction), b = fraction;
  if (1 - dot > .00001) {
    const degrees = Math.fround(Math.acos(dot) * Math.fround(57.2957763671875));
    const toRadians = Math.fround(.01745329238474369);
    const inverse = Math.fround(1 / Math.sin(degrees * toRadians));
    a = Math.fround(Math.sin((1 - fraction) * degrees * toRadians) * inverse);
    b = Math.sin(degrees * fraction * toRadians) * inverse;
  }
  return left.map((value, index) => Math.fround(a * value + b * right[index]));
}

function quaternionMatrix([x, y, z, w]: number[]): EffectNativeMatrix {
  const yy = Math.fround(2*y*y), zz = Math.fround(2*z*z), xz = Math.fround(2*x*z);
  const xw = Math.fround(2*x*w), yz = Math.fround(2*y*z), yw = Math.fround(2*y*w);
  const xy = 2*x*y, xx = 2*x*x, zw = 2*z*w;
  return [Math.fround(1-yy-zz),Math.fround(zw+xy),Math.fround(xz-yw),0,
    Math.fround(xy-zw),Math.fround(1-xx-zz),Math.fround(yz+xw),0,
    Math.fround(yw+xz),Math.fround(yz-xw),Math.fround(1-xx-yy),0,0,0,0,1];
}

/** gbAnimatedMesh interpolates XYZ and UV, and copies the next frame's normal. */
export function effectModelVertices(frames: readonly (readonly number[][])[], times: readonly number[], time: number): number[][] {
  time = Math.fround(time);
  const last = times.length - 1;
  if (time >= times[last]) return frames[last].map(vertex => [...vertex.slice(5, 8), ...vertex.slice(2, 5), ...vertex.slice(0, 2)]);
  let first = 0;
  while (time > times[first + 1]) ++first;
  const second = first + 1;
  const fraction = Math.fround((Math.fround(time) - times[first]) / (times[second] - times[first]));
  const inverse = Math.fround(1 - fraction);
  return frames[first].map((vertex, index) => {
    const next = frames[second][index];
    const mix = (axis: number): number => Math.fround(inverse * vertex[axis] + fraction * next[axis]);
    return [mix(5), mix(6), mix(7), ...next.slice(2, 5), mix(0), mix(1)];
  });
}
