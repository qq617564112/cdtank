import type {HomeSourceUi} from './source-ui-layout';
import type {CSSProperties} from 'react';
import {imageBackgroundStyle} from '../../assets/image-artwork';

/** Resolve original imageset regions for every source image reference. */
export function sourceUiImage(ui: HomeSourceUi, reference?: string) {
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
  const style: CSSProperties = asset ? imageBackgroundStyle(`/${asset}`) : {};
  return {asset, tankThumbnail: false, petThumbnail: false, tankMark: undefined, style};
}
