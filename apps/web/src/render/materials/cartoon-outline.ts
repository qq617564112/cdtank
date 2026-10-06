import {AbstractMesh, Color3, InstancedMesh, Mesh, VertexBuffer} from '@babylonjs/core';
import '@babylonjs/core/Rendering/outlineRenderer';

/** cartoon.gbf silhouette: position + normal * Ink, black RGB. */
export const CARTOON_INK = 0.65;

export function applyCartoonOutlines(meshes: readonly AbstractMesh[]): void {
  for (const mesh of meshes) {
    const source = mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh;
    if (!(source instanceof Mesh) || !source.isVerticesDataPresent(VertexBuffer.NormalKind)) continue;
    // Cutout cards already carry their silhouette in texture alpha. Expanding
    // their rectangular geometry would turn foliage and shop signs into slabs.
    if (source.material?.needAlphaBlendingForMesh(source)) continue;
    if (source.material?.needAlphaTestingForMesh(source)) {
      const positions = source.getVerticesData(VertexBuffer.PositionKind)!;
      const normals = source.getVerticesData(VertexBuffer.NormalKind)!;
      const distance = positions[0] * normals[0] + positions[1] * normals[1] + positions[2] * normals[2];
      let planar = true;
      for (let index = 3; index < positions.length; index += 3) {
        if (Math.abs(positions[index] * normals[0] + positions[index + 1] * normals[1]
          + positions[index + 2] * normals[2] - distance) > 0.001) {
          planar = false;
          break;
        }
      }
      if (planar) continue;
    }
    source.outlineWidth = CARTOON_INK;
    source.outlineColor = Color3.Black();
    source.renderOutline = true;
  }
}
