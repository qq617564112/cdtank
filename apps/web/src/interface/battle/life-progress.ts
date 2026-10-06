/** Original WLProgressBar pixel extent and three-band colour selection. */
export function lifeProgress(hp: number, maxHp: number, pixelLength: number): {fraction: number; extent: number; band: number} {
  const fraction = Math.max(0, Math.min(1, Math.fround(Math.fround(hp) / maxHp)));
  return {fraction, extent: Math.floor(pixelLength * fraction + .5),
    band: fraction < Math.fround(.34) ? 0 : fraction < Math.fround(.67) ? 1 : 2};
}
