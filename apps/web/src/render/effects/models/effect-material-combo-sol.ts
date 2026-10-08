export interface EffectModelMaterialSelection {
  flags: number;
  script: 'newgeom' | 'geom_t' | 'geom_c1' | 'geom_t_c1';
}

/**
 * Original AttachSelf selection for source kind0/1. The fog/light flag bits
 * are the same ones the actor selector uses: 0x10/0x20/0x40 for fog and
 * 0x4/0x8 for the two selected light records. This helper keeps the plain
 * script names; the shared scene environment supplies the registers.
 */
export function effectModelMaterialSelection(fvf: number, kind: number,
  inheritedBlend: 0 | 1, fogFlags = 0, lightFlags = 0): EffectModelMaterialSelection {
  const vertexColor = (fvf & 4) !== 0;
  const transparent = kind === 1 || inheritedBlend === 1;
  return {
    flags: (vertexColor ? 0x801 : 1) | (transparent ? 0x80 : 0) | fogFlags | lightFlags,
    script: vertexColor ? (transparent ? 'geom_t_c1' : 'geom_c1') :
      (transparent ? 'geom_t' : 'newgeom'),
  };
}
