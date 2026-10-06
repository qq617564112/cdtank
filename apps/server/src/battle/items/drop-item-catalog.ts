import {readFileSync} from 'node:fs';
import {classifyInventoryCategory} from '../../../../shared/combat/inventory-query';
import {sourceTablePath} from '../../runtime/content-paths';
import {combatItems} from '../catalog';

interface DropItemTable {
  rows: {values: Record<string, string>}[];
}

export interface DropItemVisual {
  modelId: string;
  texture: 'A' | 'B';
  soundId: string;
  effectId: string;
}

interface DropItemRow extends DropItemVisual {
  category: number;
  minimum: number;
  maximum: number;
}

const table = JSON.parse(readFileSync(sourceTablePath('dropitem'), 'utf8')) as DropItemTable;
const rows: DropItemRow[] = table.rows.flatMap(row => {
  const values = row.values;
  const itemType = values.ItemType ?? '';
  const category = Math.floor(Number(itemType) / 10);
  const minimum = Number(values.Min);
  const maximum = Number(values.Max);
  const texture = values.ItemTexture;
  if (!Number.isInteger(category) || category < 1 || category > 6
      || !Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum
      || !values.ItemID || !values.SoundFile || !values.EffectFile
      || (texture !== 'A' && texture !== 'B')) return [];
  return [{
    category,
    minimum,
    maximum,
    modelId: values.ItemID,
    texture,
    soundId: values.SoundFile,
    effectId: values.EffectFile,
  }];
});

/**
 * Source dropitem rows map item categories and quantity tiers to scene visuals.
 * The first matching row wins, including the overlapping category-2 tier at quantity 5.
 */
export function selectDropVisual(itemTableId: number, quantity: number): DropItemVisual | undefined {
  const id = itemTableId >>> 0;
  if (!combatItems.has(id) || !Number.isInteger(quantity) || quantity < 1) return undefined;
  const category = classifyInventoryCategory(id);
  if (category < 1 || category > 6) return undefined;
  const row = rows.find(value => value.category === category
    && quantity >= value.minimum && quantity <= value.maximum);
  if (!row) return undefined;
  return {
    modelId: row.modelId,
    texture: row.texture,
    soundId: row.soundId,
    effectId: row.effectId,
  };
}
