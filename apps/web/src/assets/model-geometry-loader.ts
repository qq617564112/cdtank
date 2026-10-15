import type {Geometry, Mesh} from '@babylonjs/core';
import {ArrayItem, GLTFLoader, registerGLTFExtension, type IGLTFLoaderExtension,
  type IMeshPrimitive} from '@babylonjs/loaders/glTF/2.0';

export const PRECOMPUTED_GEOMETRY = 'CDTANK_precomputed_geometry';
export interface PrecomputedGeometry {
  outlineNormal?: number;
  planar: boolean;
  morphLayers?: readonly number[];
}

class ModelGeometryExtension implements IGLTFLoaderExtension {
  readonly name = PRECOMPUTED_GEOMETRY;
  readonly enabled = true;

  constructor(private loader: GLTFLoader | undefined) {}

  _loadVertexDataAsync(context: string, primitive: IMeshPrimitive, mesh: Mesh): Promise<Geometry> | null {
    return GLTFLoader.LoadExtensionAsync<PrecomputedGeometry, Geometry>(context, primitive, this.name,
      (extensionContext, prepared) => {
        const loader = this.loader!;
        mesh._internalMetadata ??= {};
        mesh._internalMetadata.cdtankOutlinePlanar = prepared.planar;
        mesh._internalMetadata.cdtankMorphLayers = prepared.morphLayers;
        // The native extension dispatch skips this active extension on reentry.
        const load = Reflect.get(loader, '_loadVertexDataAsync') as
          (context: string, primitive: IMeshPrimitive, mesh: Mesh) => Promise<Geometry>;
        const geometry = load.call(loader, context, primitive, mesh);
        if (prepared.outlineNormal === undefined) return geometry;
        const accessor = ArrayItem.Get(extensionContext, loader.gltf.accessors, prepared.outlineNormal);
        return Promise.all([geometry, loader._loadFloatAccessorAsync(`/accessors/${accessor.index}`, accessor)])
          .then(([geometry, normals]) => {
            // Upload only if this mesh later qualifies for an outline pass.
            mesh._internalMetadata.cdtankOutlineNormals = normals;
            return geometry;
          });
      });
  }

  dispose(): void {this.loader = undefined;}
}

let installed = false;

/** Derived streams load with native geometry and share its clone/disposal lifecycle. */
export function installModelGeometryLoader(): void {
  if (installed) return;
  installed = true;
  registerGLTFExtension(PRECOMPUTED_GEOMETRY, true, loader => new ModelGeometryExtension(loader));
}
