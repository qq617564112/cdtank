import {MorphTarget, type MorphTargetManager, type Scene} from '@babylonjs/core';

interface Mv3MorphPixels {
  data: Float32Array;
  vertices: number;
  layerSize: number;
}

const textureLayers = new WeakMap<MorphTargetManager, Uint16Array>();

/** Source target numbers remain unchanged even when identical poses share a layer. */
export function mv3MorphTextureLayers(manager: MorphTargetManager): Uint16Array | undefined {
  return textureLayers.get(manager);
}

/** Read offline layer assignments while the native glTF target updates are frozen. */
export function prepareMv3MorphTargets(manager: MorphTargetManager, scene: Scene, sourceLayers: readonly number[]): void {
  const layers = Uint16Array.from(sourceLayers);
  const synchronize = manager.synchronize;
  manager.synchronize = () => {
    if (!manager.isUsingTextureForTargets || manager.numTargets === 0
      || manager.numTargets > scene.getEngine().getCaps().texture2DArrayMaxLayerCount) {
      synchronize.call(manager);
      return;
    }
    const targets = Reflect.get(manager, '_targets') as MorphTarget[];
    const unique: MorphTarget[] = [];
    for (let index = 0; index < targets.length; index++) {
      if (!unique[layers[index]]) unique[layers[index]] = targets[index];
    }
    if (unique.length === targets.length) {
      synchronize.call(manager);
      return;
    }
    // Native packing uploads the distinct poses once; all public target indices stay original.
    Reflect.set(manager, '_targets', unique);
    try {
      synchronize.call(manager);
    } finally {
      Reflect.set(manager, '_targets', targets);
    }
    textureLayers.set(manager, layers);
  };
}

/** CPU reads unpack the immutable RGBA poses without retaining another vertex copy. */
class TextureMv3Target extends MorphTarget {
  constructor(source: MorphTarget, private readonly pixels: Mv3MorphPixels,
    private readonly layer: number, private readonly scene: Scene) {
    super(source.name, source.influence, scene);
    this.id = source.id;
  }

  override get hasPositions(): boolean {return true;}
  override get hasNormals(): boolean {return true;}
  override get vertexCount(): number {return this.pixels.vertices;}
  override getPositions(): Float32Array {return this.read(0);}
  override getNormals(): Float32Array {return this.read(4);}

  override clone(): MorphTarget {
    return new TextureMv3Target(this, this.pixels, this.layer, this.scene);
  }

  private read(attributeOffset: number): Float32Array {
    const values = new Float32Array(this.pixels.vertices * 3);
    const start = this.layer * this.pixels.layerSize + attributeOffset;
    for (let vertex = 0; vertex < this.pixels.vertices; vertex++) {
      const offset = start + vertex * 8;
      values[vertex * 3] = this.pixels.data[offset];
      values[vertex * 3 + 1] = this.pixels.data[offset + 1];
      values[vertex * 3 + 2] = this.pixels.data[offset + 2];
    }
    return values;
  }
}

/** Immutable templates retain their existing layout and restore buffer. */
function retainMorphTexture(): void {}

/** convert_mv3.py emits POSITION and NORMAL for every source pose. */
export function compactMv3MorphTargets(manager: MorphTargetManager, scene: Scene): void {
  if (!manager.isUsingTextureForTargets || manager.numTargets === 0) return;
  const data = manager._targetStoreTexture?.getInternalTexture()?._bufferView;
  if (!(data instanceof Float32Array) || !manager.hasPositions || !manager.hasNormals
    || manager._textureVertexStride !== 2) throw new Error('MV3 形变纹理必须保留位置和法线浮点缓冲');
  const pixels = {data, vertices: manager.vertexCount,
    layerSize: manager._textureWidth * manager._textureHeight * 4};
  const layers = textureLayers.get(manager);
  const targets = Array.from({length: manager.numTargets}, (_, index) => manager.getTarget(index));
  manager.areUpdatesFrozen = true;
  // The source poses never change; synchronizing must not repack or replace their shared texture.
  manager.synchronize = retainMorphTexture;
  for (const target of targets) manager.removeTarget(target);
  // Only instances change weights; immutable template targets need no change observers.
  const compactTargets = Reflect.get(manager, '_targets') as MorphTarget[];
  for (const [index, target] of targets.entries()) {
    compactTargets.push(new TextureMv3Target(target, pixels, layers?.[index] ?? index, scene));
  }
  manager.areUpdatesFrozen = false;
}
