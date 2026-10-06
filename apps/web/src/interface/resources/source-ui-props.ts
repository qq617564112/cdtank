import type {CSSProperties} from 'react';
import type {HomeSourceLayout, HomeSourceUi} from './source-ui-layout';

export function sourceProps(ui: HomeSourceUi, layout: HomeSourceLayout, suffix: string,
  name: string, image?: string, offsetX = 0, offsetY = 0, absolute = false) {
  const source = layout.control(name);
  const rectangle = (control: typeof source) => control.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const box = rectangle(source);
  let left = box[0], top = box[1];
  if (!absolute) for (let parent = source.parent; parent;) {
    const owner = layout.control(parent), position = rectangle(owner);
    left += position[0]; top += position[1]; parent = owner.parent;
  }
  const match = /^set:(\S+) image:(.+)$/.exec(image ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const asset = set?.images.find(value => value.Name === match?.[2])?.asset;
  const style: CSSProperties = {left: left + offsetX, top: top + offsetY,
    width: box[2] - box[0], height: box[3] - box[1], backgroundImage: asset ? `url('/${asset}')` : undefined};
  return {style, 'data-source-control': name, 'data-source-layout': `ui/layouts/${suffix}`, 'data-source-asset': asset};
}
