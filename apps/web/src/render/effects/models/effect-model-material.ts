import {effectModelMaterialSelection} from './effect-material-combo-sol';

export interface EffectModelGraphicsState {ambient: readonly number[]; emissive: number;}

/** gbengine 0x1001b6f0 parameter 4 for the source model GBFs without fog/lights. */
export function effectModelAmbient(properties: readonly number[], alpha: number, graphics: EffectModelGraphicsState): number[] {
  const ambient = graphics.ambient.map(Math.fround);
  const emissive = Math.fround(graphics.emissive);
  return [0,1,2].map(axis => Math.fround(Math.fround(ambient[axis] * properties[4 + axis]) +
    Math.fround(emissive * properties[12 + axis]))).concat(Math.fround(Math.fround(alpha) * properties[3]));
}

/** Original gbGeomNode chooses the GBF by vertex layout, section kind and node blend. */
export function effectModelScript(fvf: number, kind: number, alpha: number): string {
  return effectModelMaterialSelection(fvf, kind, alpha < 1 ? 1 : 0).script;
}
