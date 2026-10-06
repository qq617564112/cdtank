import type {EffectVec3} from './types';

export interface EffectQuadVertex {
  position: EffectVec3;
  uv: [number, number];
  color: number;
  rhw?: number;
}

/** Original gbDynVertBuf::RenderGeomQuad, gbengine.dll 0x100258a0. */
export function expandEffectQuad(
  corners: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3],
  uv: readonly [number, number, number, number],
  color: number,
  screenSpace: boolean,
): EffectQuadVertex[] {
  // Native triangles use corners 0,1,3 and 3,1,2, not a 0,2 diagonal.
  const cornerOrder = [0, 1, 3, 3, 1, 2];
  const coordinates: [number, number][] = [
    [uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]],
  ];
  return cornerOrder.map(index => ({
    position: corners[index].map(Math.fround) as EffectVec3,
    uv: coordinates[index].map(Math.fround) as [number, number],
    color: color >>> 0,
    ...(screenSpace ? {rhw: 1} : {}),
  }));
}

export interface EffectStripVertex {
  position: EffectVec3;
  uv: [number, number];
  color: number;
}

/** Preserve alternating triangle-strip winding when submitting an indexed mesh. */
export function effectStripTriangleIndices(vertexCount: number): number[] {
  const indices: number[] = [];
  for (let index = 2; index < vertexCount; ++index) {
    indices.push(index % 2 === 0 ? index - 2 : index - 1,
      index % 2 === 0 ? index - 1 : index - 2, index);
  }
  return indices;
}
