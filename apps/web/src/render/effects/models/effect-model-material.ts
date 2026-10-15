import {effectModelMaterialSelection} from './effect-material-combo-sol';

export interface EffectModelGraphicsState {ambient: readonly number[]; emissive: number;}

/** gbengine 0x1001b6f0 parameter 4 for the source model GBFs without fog/lights. */
export function effectModelAmbient(properties: readonly number[], alpha: number, graphics: EffectModelGraphicsState,
  result: number[] = new Array<number>(4)): number[] {
  effectModelAmbientColor(properties, graphics, result);
  result[3] = Math.fround(Math.fround(alpha) * properties[3]);
  return result;
}

/** RGB depends on fixed material parameters and the current graphics ambient. */
export function effectModelAmbientColor(properties: readonly number[], graphics: EffectModelGraphicsState,
  result: number[]): void {
  const emissive = Math.fround(graphics.emissive);
  for (let axis = 0; axis < 3; axis++) result[axis] = Math.fround(
    Math.fround(Math.fround(graphics.ambient[axis]) * properties[4 + axis]) +
    Math.fround(emissive * properties[12 + axis]));
}

/** Original gbGeomNode chooses the GBF by vertex layout, section kind and node blend. */
export function effectModelScript(fvf: number, kind: number, alpha: number): string {
  return effectModelMaterialSelection(fvf, kind, alpha < 1 ? 1 : 0).script;
}
