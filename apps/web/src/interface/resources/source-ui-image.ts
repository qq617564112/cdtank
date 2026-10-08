import './source-tank-icon.css';
import './source-pet-icon.css';
import {tankThumbnails} from '../../assets/tanks/thumbnails';
import {petThumbnails} from '../../assets/pets/thumbnails';
import type {HomeSourceUi} from './source-ui-layout';
import {imageResourceBackground, imageResourceUrl} from '../../assets/image-cache';
import {sourceTextArtwork} from './source-text-artwork';

const TANK_ICON_MARKS = ['轻', '中', '重', 'Ⅱ', 'Ⅲ'];

/** Model-rendered role icons share the source references used throughout the UI. */
export function sourceUiImage(ui: HomeSourceUi, reference?: string) {
  const tank = /^set:tanke0 image:data\\ui\\tanke\\(\d+)\.tga$/i.exec(reference ?? '');
  const thumbnail = tankThumbnails[tank?.[1] ?? ''];
  if (thumbnail) {
    const id = Number(tank![1]);
    const category = id < 50 ? 0 : id < 100 ? 1 : id < 150 ? 2 : id < 155 ? 3 : 4;
    return {asset: thumbnail, url: imageResourceUrl(thumbnail), tankThumbnail: true, petThumbnail: false, tankMark: TANK_ICON_MARKS[category],
      backgroundImage: imageResourceBackground(thumbnail)};
  }
  const pet = /^set:gy0 image:data\\ui\\gy\\maogou_(\d+)\.tga$/i.exec(reference ?? '');
  const portrait = pet && petThumbnails[String(Number(pet[1])).padStart(3, '0')];
  if (portrait) {
    return {asset: portrait, url: imageResourceUrl(portrait), tankThumbnail: false, petThumbnail: true, tankMark: undefined,
      backgroundImage: imageResourceBackground(portrait)};
  }
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  const sets = ui.imagesets.filter(set => set.attributes.Name === match?.[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  const asset = set?.images.find(image => image.Name === match?.[2])?.asset;
  const url = asset && !sourceTextArtwork(asset) ? imageResourceUrl(`/${asset}`) : undefined;
  return {asset, url, tankThumbnail: false, petThumbnail: false, tankMark: undefined,
    backgroundImage: url ? `url('${url}')` : undefined};
}
