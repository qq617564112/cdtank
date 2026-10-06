import type {CSSProperties} from 'react';
import type {SourceRegion, SourceUi, SourceWindow} from './battle-hud';

/** Resolve a `set:<imageset> image:<name>` reference into its published region. */
export function sourceRegion(data: SourceUi, reference?: string): SourceRegion | undefined {
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  if (!match) return;
  const sets = data.imagesets.filter(set => set.attributes.Name === match[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  return set?.images.find(region => region.Name === match[2]);
}

export function sourceAsset(data: SourceUi, reference?: string): string | undefined {
  return sourceRegion(data, reference)?.asset;
}

export function sourcePicture(data: SourceUi, reference?: string): CSSProperties {
  const asset = sourceAsset(data, reference);
  return asset ? {backgroundImage: `url('/${asset}')`, backgroundSize: '100% 100%'} : {};
}

export function absoluteRect(control: SourceWindow): {left: number; top: number; width: number; height: number} {
  const rect = control.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  return {left: rect[0], top: rect[1], width: rect[2] - rect[0], height: rect[3] - rect[1]};
}
