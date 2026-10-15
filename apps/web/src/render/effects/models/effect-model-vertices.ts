import {BoundingInfo, Constants, Geometry, Mesh, RawTexture, Scene, ShaderMaterial, Texture,
  Vector2, Vector3, Vector4, VertexData} from '@babylonjs/core';

export interface EffectModelVertexData {
  readonly vertexCount: number;
  readonly frameCount: number;
  readonly values: Float32Array;
  readonly colors?: Float32Array;
  readonly times?: readonly number[];
}

/** One scene uploads each immutable CVD vertex stream and frame texture once. */
class EffectModelGeometry {
  readonly positions: Float32Array;
  readonly uvs: Float32Array;
  readonly vertexIds?: Float32Array;
  readonly minimum = new Vector3(Infinity, Infinity, Infinity);
  readonly maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  readonly texture?: RawTexture;
  readonly vTexture?: RawTexture;
  readonly geometries = new Map<readonly number[], Geometry>();
  references = 0;

  constructor(readonly scene: Scene, readonly data: EffectModelVertexData, readonly animated: boolean) {
    const count = data.vertexCount;
    this.positions = new Float32Array(count * 3);
    this.uvs = new Float32Array(count * 2);
    const width = Math.min(scene.getEngine().getCaps().maxTextureSize, Math.max(1, count));
    const height = Math.ceil(count * data.frameCount / width);
    const pixels = animated && data.frameCount > 1 ? new Float32Array(width * height * 4) : undefined;
    const vPixels = pixels ? new Float32Array(width * height) : undefined;
    for (let frame = 0; frame < data.frameCount; frame++) {
      for (let index = 0; index < count; index++) {
        const offset = (frame * count + index) * 5;
        const x = data.values[offset], y = data.values[offset + 1], z = data.values[offset + 2];
        const u = data.values[offset + 3], v = data.values[offset + 4];
        this.minimum.x = Math.min(this.minimum.x, -x);
        this.minimum.y = Math.min(this.minimum.y, y);
        this.minimum.z = Math.min(this.minimum.z, z);
        this.maximum.x = Math.max(this.maximum.x, -x);
        this.maximum.y = Math.max(this.maximum.y, y);
        this.maximum.z = Math.max(this.maximum.z, z);
        if (frame === 0) {
          this.positions[index * 3] = -x;
          this.positions[index * 3 + 1] = y;
          this.positions[index * 3 + 2] = z;
          this.uvs[index * 2] = u;
          this.uvs[index * 2 + 1] = v;
        }
        if (pixels) {
          const vertex = frame * count + index;
          const target = vertex * 4;
          pixels[target] = x; pixels[target + 1] = y; pixels[target + 2] = z;
          pixels[target + 3] = u; vPixels![vertex] = v;
        }
      }
    }
    if (pixels) {
      this.vertexIds = Float32Array.from({length: count}, (_, index) => index);
      this.texture = RawTexture.CreateRGBATexture(pixels, width, height, scene,
        false, false, Texture.NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
      this.texture.name = 'source-cvd-frames';
      this.texture.wrapU = this.texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      this.vTexture = RawTexture.CreateRTexture(vPixels!, width, height, scene,
        false, false, Texture.NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
      this.vTexture.name = 'source-cvd-frame-v';
      this.vTexture.wrapU = this.vTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
    }
  }

  apply(mesh: Mesh, indices: readonly number[]): void {
    let geometry = this.geometries.get(indices);
    if (!geometry || geometry.isDisposed()) {
      const data = new VertexData();
      data.positions = this.positions;
      data.uvs = this.uvs;
      if (this.data.colors) data.colors = this.data.colors;
      data.indices = indices as number[];
      geometry = new Geometry('source-cvd-geometry', this.scene, data, false);
      if (this.texture) geometry.setVerticesData('sourceVertexId', this.vertexIds!, false, 1);
      this.geometries.set(indices, geometry);
    }
    geometry.applyToMesh(mesh);
  }

  dispose(): void {
    this.texture?.dispose();
    this.vTexture?.dispose();
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
  }
}

const sceneGeometries = new WeakMap<Scene, Map<EffectModelVertexData, EffectModelGeometry>>();

/** Each instance owns its sampling uniform while borrowing the model's frame data. */
export class EffectModelVertices {
  private readonly shared: EffectModelGeometry;
  private readonly cache: Map<EffectModelVertexData, EffectModelGeometry>;
  readonly sample = new Vector4(0, 0, 0, 1);
  private lastTime?: number;
  private disposed = false;

  constructor(scene: Scene, private readonly data: EffectModelVertexData, readonly animated: boolean) {
    let cache = sceneGeometries.get(scene);
    if (!cache) {
      cache = new Map();
      sceneGeometries.set(scene, cache);
      scene.onDisposeObservable.addOnce(() => {cache!.clear(); sceneGeometries.delete(scene);});
    }
    this.cache = cache;
    this.shared = cache.get(data) ?? new EffectModelGeometry(scene, data, animated);
    cache.set(data, this.shared);
    this.shared.references++;
  }

  get colors(): Float32Array | undefined {return this.data.colors;}
  get usesFrameTexture(): boolean {return !!this.shared.texture;}
  apply(mesh: Mesh, indices: readonly number[]): void {this.shared.apply(mesh, indices);}

  bind(material: ShaderMaterial): void {
    if (!this.animated) return;
    material.setVector4('sourceFrameSample', this.sample);
    if (!this.shared.texture) return;
    const size = this.shared.texture.getSize();
    material.setTexture('sourceFrames', this.shared.texture);
    material.setTexture('sourceFrameV', this.shared.vTexture!);
    material.setVector2('sourceFrameSize', new Vector2(size.width, size.height));
  }

  setTime(time: number): void {
    if (!this.animated || this.lastTime === time) return;
    this.lastTime = time;
    const times = this.data.times!;
    const local = Math.fround(time);
    if (times.length < 2 || local >= times[times.length - 1]) {
      const offset = (this.data.frameCount - 1) * this.data.vertexCount;
      this.sample.set(offset, offset, 0, 1);
    } else {
      let index = 0, high = times.length - 2;
      while (index < high) {
        const middle = Math.ceil((index + high) / 2);
        if (times[middle] <= local) index = middle;
        else high = middle - 1;
      }
      const fraction = Math.fround((local - times[index]) / (times[index + 1] - times[index]));
      this.sample.set(index * this.data.vertexCount, (index + 1) * this.data.vertexCount,
        fraction, Math.fround(1 - fraction));
    }
  }

  bounds(): BoundingInfo {return new BoundingInfo(this.shared.minimum, this.shared.maximum);}
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (--this.shared.references === 0) {this.cache.delete(this.data); this.shared.dispose();}
  }
}
