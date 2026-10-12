import type {HomeSourceUi} from './source-ui-layout';
import type {CSSProperties} from 'react';
import {imageBackgroundStyle} from '../../assets/image-artwork';
import {petThumbnails} from '../../assets/pets/thumbnails';
import {tankThumbnails} from '../../assets/tanks/thumbnails';
import {tankIconMarks} from '../../assets/tanks/icon-marks';

/** Resolve source regions and their HD pet or tank artwork. */
export function sourceUiImage(ui: HomeSourceUi, reference?: string) {
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const petId = match?.[1] === 'gy0' ? /^data\\ui\\gy\\maogou_(\d+)\.tga$/.exec(match[2])?.[1] : undefined;
  const tankId = match?.[1] === 'tanke0' ? /^data\\ui\\tanke\\(\d{3})\.tga$/.exec(match[2])?.[1] : undefined;
  const petThumbnail = petId ? petThumbnails[petId.padStart(3, '0')] : undefined;
  const tankThumbnail = tankId ? tankThumbnails[tankId] : undefined;
  const thumbnail = tankThumbnail ?? petThumbnail;
  const tankMark = tankThumbnail && tankId ? tankIconMarks[tankId] : undefined;
  const asset = thumbnail ? thumbnail.replace(/^\//, '')
    : set?.images.find(image => image.Name === match?.[2])?.asset;
  const style: CSSProperties = asset ? imageBackgroundStyle(`/${asset}`) : {};
  if (thumbnail) {style.backgroundSize = '100% 100%'; style.backgroundRepeat = 'no-repeat';}
  return {asset, tankThumbnail: Boolean(tankThumbnail), petThumbnail: Boolean(petThumbnail), tankMark, style};
}
