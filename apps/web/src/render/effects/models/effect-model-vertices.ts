import {BoundingInfo, Constants, RawTexture, Scene, ShaderMaterial, Texture,
  Vector2, Vector3, Vector4, VertexData} from '@babylonjs/core';

export interface EffectModelVertexData {
  vertices?: readonly (readonly number[])[];
  colors?: readonly (readonly number[])[];
  frames?: readonly (readonly (readonly number[])[])[];
  times?: readonly number[];
}

/** Immutable CVD frames are sampled by the vertex shader, shared by all parts. */
export class EffectModelVertices {
  readonly positions: Float32Array;
  readonly uvs: Float32Array;
  readonly colors?: Float32Array;
  readonly vertexIds: Float32Array;
  readonly minimum = new Vector3(Infinity, Infinity, Infinity);
  readonly maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  readonly sample = new Vector4(0, 0, 0, 1);
  readonly texture?: RawTexture;
  private lastTime?: number;
  private readonly vertexCount: number;

  constructor(scene: Scene, private readonly data: EffectModelVertexData, readonly animated: boolean) {
    this.vertexCount = animated ? data.frames![0].length : data.vertices!.length;
    this.positions = new Float32Array(this.vertexCount * 3);
    this.uvs = new Float32Array(this.vertexCount * 2);
    this.vertexIds = Float32Array.from({length: this.vertexCount}, (_, index) => index);
    if (data.colors) this.colors = Float32Array.from(data.colors.flat());
    const frames = animated ? data.frames! : [data.vertices!];
    const texels = this.vertexCount * frames.length * 2;
    const width = Math.min(scene.getEngine().getCaps().maxTextureSize, Math.max(1, this.vertexCount * 2));
    const height = Math.ceil(texels / width);
    const pixels = animated ? new Float32Array(width * height * 4) : undefined;
    for (let frame = 0; frame < frames.length; frame++) {
      for (let index = 0; index < this.vertexCount; index++) {
        const vertex = frames[frame][index];
        const x = animated ? vertex[5] : vertex[0];
        const y = animated ? vertex[6] : vertex[1];
        const z = animated ? vertex[7] : vertex[2];
        const u = animated ? vertex[0] : vertex[6];
        const v = animated ? vertex[1] : vertex[7];
        this.minimum.x = Math.min(this.minimum.x, -x);
        this.minimum.y = Math.min(this.minimum.y, y);
        this.minimum.z = Math.min(this.minimum.z, z);
        this.maximum.x = Math.max(this.maximum.x, -x);
        this.maximum.y = Math.max(this.maximum.y, y);
        this.maximum.z = Math.max(this.maximum.z, z);
        if (frame === 0) {
          this.positions.set([-x, y, z], index * 3);
          this.uvs.set([u, v], index * 2);
        }
        if (pixels) {
          const offset = (frame * this.vertexCount + index) * 8;
          pixels[offset] = x; pixels[offset + 1] = y; pixels[offset + 2] = z;
          pixels[offset + 4] = u; pixels[offset + 5] = v;
        }
      }
    }
    if (pixels) {
      this.texture = RawTexture.CreateRGBATexture(pixels, width, height, scene,
        false, false, Texture.NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
      this.texture.name = 'source-cvd-frames';
      this.texture.wrapU = this.texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    }
  }

  geometry(indices: readonly number[]): VertexData {
    const data = new VertexData();
    data.positions = this.positions;
    data.uvs = this.uvs;
    if (this.colors) data.colors = this.colors;
    data.indices = [...indices];
    return data;
  }

  bind(material: ShaderMaterial): void {
    if (!this.texture) return;
    const size = this.texture.getSize();
    material.setTexture('sourceFrames', this.texture);
    material.setVector2('sourceFrameSize', new Vector2(size.width, size.height));
    material.setVector4('sourceFrameSample', this.sample);
  }

  setTime(time: number): void {
    if (!this.animated || this.lastTime === time) return;
    this.lastTime = time;
    const times = this.data.times!;
    const local = Math.fround(time);
    let index = 0;
    while (index + 1 < times.length - 1 && times[index + 1] <= local) index++;
    if (index + 1 >= times.length || local >= times[times.length - 1]) {
      const offset = (this.data.frames!.length - 1) * this.vertexCount;
      this.sample.set(offset, offset, 0, 1);
    } else {
      const fraction = Math.fround((local - times[index]) / (times[index + 1] - times[index]));
      this.sample.set(index * this.vertexCount, (index + 1) * this.vertexCount,
        fraction, Math.fround(1 - fraction));
    }
  }

  bounds(): BoundingInfo {return new BoundingInfo(this.minimum, this.maximum);}
  dispose(): void {this.texture?.dispose();}
}
