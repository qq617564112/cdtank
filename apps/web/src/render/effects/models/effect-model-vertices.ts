import {Constants, Geometry, Mesh, RawTexture, Scene, ShaderMaterial, Texture,
  Vector2, Vector3, Vector4, VertexData} from '@babylonjs/core';

export interface EffectModelVertexData {
  readonly vertexCount: number;
  readonly frameCount: number;
  readonly positions: Float32Array;
  readonly uvs: Float32Array;
  readonly minimum: readonly number[];
  readonly maximum: readonly number[];
  readonly frames?: {
    readonly width: number;
    readonly height: number;
    readonly pixels: Float32Array;
    readonly vs: Float32Array;
    readonly vertexIds: Float32Array;
    readonly indices: Uint32Array;
  };
  readonly colors?: Float32Array;
  readonly times?: readonly number[];
}

/** One scene uploads each immutable CVD vertex stream and frame texture once. */
class EffectModelGeometry {
  readonly positions: Float32Array;
  readonly uvs: Float32Array;
  readonly vertexIds?: Float32Array;
  readonly minimum: Vector3;
  readonly maximum: Vector3;
  readonly texture?: RawTexture;
  readonly vTexture?: RawTexture;
  readonly geometries = new Map<readonly number[], Geometry>();
  references = 0;

  constructor(readonly scene: Scene, readonly data: EffectModelVertexData, readonly animated: boolean) {
    this.positions = data.positions;
    this.uvs = data.uvs;
    this.minimum = Vector3.FromArray(data.minimum);
    this.maximum = Vector3.FromArray(data.maximum);
    const frames = animated ? data.frames : undefined;
    if (frames) {
      this.vertexIds = frames.vertexIds;
      this.texture = RawTexture.CreateRGBATexture(frames.pixels, frames.width, frames.height, scene,
        false, false, Texture.NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_FLOAT);
      this.texture.name = 'source-cvd-frames';
      this.texture.wrapU = this.texture.wrapV = Texture.CLAMP_ADDRESSMODE;
      this.vTexture = RawTexture.CreateRTexture(frames.vs, frames.width, frames.height, scene,
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
  apply(mesh: Mesh, indices: readonly number[]): void {
    this.shared.apply(mesh, indices);
    // Expand the native per-mesh bounds to every animation frame. Its global
    // submesh reads these same bounds instead of keeping a second object tree.
    mesh.getBoundingInfo().reConstruct(this.shared.minimum, this.shared.maximum);
  }

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
    const frames = this.data.frames?.indices;
    const local = Math.fround(time);
    if (times.length < 2 || local >= times[times.length - 1]) {
      const offset = (frames?.[this.data.frameCount - 1] ?? 0) * this.data.vertexCount;
      this.sample.set(offset, offset, 0, 1);
    } else {
      let index = 0, high = times.length - 2;
      while (index < high) {
        const middle = Math.ceil((index + high) / 2);
        if (times[middle] <= local) index = middle;
        else high = middle - 1;
      }
      const fraction = Math.fround((local - times[index]) / (times[index + 1] - times[index]));
      this.sample.set((frames?.[index] ?? 0) * this.data.vertexCount, (frames?.[index + 1] ?? 0) * this.data.vertexCount,
        fraction, Math.fround(1 - fraction));
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (--this.shared.references === 0) {this.cache.delete(this.data); this.shared.dispose();}
  }
}
