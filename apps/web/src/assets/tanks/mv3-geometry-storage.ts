import type {IGLTFLoaderData} from '@babylonjs/loaders/glTF';
import type {IGLTF} from '@babylonjs/loaders/glTF/2.0/glTFLoaderInterfaces';

/** Base geometry owns its buffer views instead of retaining the complete MV3 GLB. */
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
    }
  }
  const copies: Promise<ArrayBufferView>[] = [];
  for (const index of views) {
    const view = document.bufferViews![index];
    // Babylon uses this cache for both vertex buffers and index accessors. Keep
    // each full view so accessor offsets, interleaving and scalar types stay intact.
    const loading = data.bin.readAsync(view.byteOffset ?? 0, view.byteLength).then(bytes => bytes.slice());
    view._data = loading;
    copies.push(loading);
  }
  await Promise.all(copies);
}
