import type {HomeSourceUi} from './source-ui-layout';
import {roomModeIconReference} from '../lobby/room-mode-icons';
import {loadStaticJson} from '../../assets/static-resources';
import {decodeImageRegion} from '../../assets/image-resources';
import {bindButtonBackgrounds, buttonArtwork} from '../../assets/button-artwork';
import {imageResourceUrl} from '../../assets/image-cache';
import {loadUiFont} from './source-ui-fonts';

export const lobbyBannerUrl = '/Data/ui/banner/ad102.png';
export const STARTUP_UI_LAYOUTS = [
  'login.xml', 'lobby_select.xml', 'default.xml', 'roomlist.xml', 'roomlist_icon.xml',
  'playerlist.xml', 'chat.xml', 'chat_channellist_lobby.xml', 'chat_emotelist.xml',
  'chat_intimatelist.xml',
] as const;

let directory: HomeSourceUi | undefined;
let loadingDirectory: Promise<HomeSourceUi> | undefined;
const preparedLayouts = new Set<string>();

export function loadSourceUi(): Promise<HomeSourceUi> {
  loadingDirectory ??= loadStaticJson<HomeSourceUi>('/ui.json').then(ui => {
    directory = ui;
    return directory;
  }).catch(error => {
    loadingDirectory = undefined;
    throw error;
  });
  return loadingDirectory;
}

export function preparedSourceUi(suffixes: readonly string[]): HomeSourceUi | undefined {
  return suffixes.every(suffix => preparedLayouts.has(suffix)) ? directory : undefined;
}

/** Resolve the same atlas regions as the controls, including their interaction states. */
export async function prepareSourceUi(suffixes: readonly string[]): Promise<HomeSourceUi> {
  const ui = await loadSourceUi();
  const urls = new Set<string>();
  const addReference = (reference: string | undefined) => {
    const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
    if (!match) return;
    const sets = ui.imagesets.filter(set => set.attributes.Name === match[1]);
    const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
    const asset = set?.images.find(image => image.Name === match[2])?.asset;
    if (asset) urls.add(buttonArtwork(asset)?.background ?? `/${asset}`);
  };
  for (const suffix of suffixes) {
    const layout = ui.layouts.find(layout => layout.path.endsWith(suffix));
    if (!layout) throw new Error(`布局缺失：${suffix}`);
    for (const control of layout.windows) {
      for (const reference of Object.values(control.properties)) addReference(reference);
    }
    if (suffix === 'default.xml') urls.add(lobbyBannerUrl);
    if (suffix === 'roomlist_icon.xml') {
      for (let mode = 1; mode <= 5; mode++) addReference(roomModeIconReference(mode));
    }
  }
  await Promise.all([loadUiFont(), ...[...urls].map(url => decodeImageRegion(url))]);
  bindButtonBackgrounds(imageResourceUrl);
  for (const suffix of suffixes) preparedLayouts.add(suffix);
  return ui;
}
