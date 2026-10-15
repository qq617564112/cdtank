import type {IGLTFLoaderData} from '@babylonjs/loaders/glTF';
import type {IGLTF} from '@babylonjs/loaders/glTF/2.0/glTFLoaderInterfaces';
import {PRECOMPUTED_GEOMETRY, type PrecomputedGeometry} from '../model-geometry-loader';

/** Base geometry shares one template-owned store without retaining the complete MV3 GLB. */
export async function compactMv3GeometrySources(data: IGLTFLoaderData): Promise<void> {
  if (!data.bin) throw new Error('MV3 几何体二进制数据缺失');
  const document = data.json as IGLTF;
  const views = new Set<number>();
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      for (const index of Object.values(primitive.attributes)) {
        const view = document.accessors![index].bufferView;
        if (view !== undefined) views.add(view);
      }
      if (primitive.indices !== undefined) {
        const view = document.accessors![primitive.indices].bufferView;
        if (view !== undefined) views.add(view);
      }
      const prepared = primitive.extensions?.[PRECOMPUTED_GEOMETRY] as PrecomputedGeometry | undefined;
      if (prepared?.outlineNormal !== undefined) {
        const view = document.accessors![prepared.outlineNormal].bufferView;
        if (view !== undefined) views.add(view);
      }
    }
  }
  if (!views.size) return;
  let byteLength = 0;
  for (const index of views) byteLength += Math.ceil(document.bufferViews![index].byteLength / 4) * 4;
  const storage = new ArrayBuffer(byteLength);
  const copies: Promise<ArrayBufferView>[] = [];
  let byteOffset = 0;
  for (const index of views) {
    const view = document.bufferViews![index];
    // Babylon uses this cache for both vertex buffers and index accessors. Keep
    // each full view and align its start so typed accessor offsets stay intact.
    const copy = new Uint8Array(storage, byteOffset, view.byteLength);
    byteOffset += Math.ceil(view.byteLength / 4) * 4;
    const loading = data.bin.readAsync(view.byteOffset ?? 0, view.byteLength).then(bytes => {
      copy.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      return copy;
    });
    view._data = loading;
    copies.push(loading);
  }
  await Promise.all(copies);
}
