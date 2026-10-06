import {EffectModelMaterialSelection, effectModelMaterialSelection} from './effect-material-combo-sol';

/** Complete original AttachSelf retains the material selected at first submission. */
export class EffectAttachMaterialCache {
  private selection?: EffectModelMaterialSelection;

  select(fvf: number, kind: number, blend: 0 | 1): EffectModelMaterialSelection {
    this.selection ??= effectModelMaterialSelection(fvf, kind, blend);
    return this.selection;
  }
}
