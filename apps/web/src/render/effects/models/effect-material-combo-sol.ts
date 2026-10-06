export interface EffectModelMaterialSelection {
  flags: number;
  script: 'newgeom' | 'geom_t' | 'geom_c1' | 'geom_t_c1';
}

/** Original AttachSelf selection for source kind0/1, no section lights or fog. */
export function effectModelMaterialSelection(fvf: number, kind: number,
  inheritedBlend: 0 | 1): EffectModelMaterialSelection {
  const vertexColor = (fvf & 4) !== 0;
  const transparent = kind === 1 || inheritedBlend === 1;
  return {
    flags: (vertexColor ? 0x801 : 1) | (transparent ? 0x80 : 0),
    script: vertexColor ? (transparent ? 'geom_t_c1' : 'geom_c1') :
      (transparent ? 'geom_t' : 'newgeom'),
  };
}
