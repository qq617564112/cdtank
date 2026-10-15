import type {HomeSourceUi} from './source-ui-layout';
import {roomModeIconReference} from '../lobby/room-mode-icons';
import {loadStaticJson} from '../../assets/static-resources';
import {decodeImageRegion} from '../../assets/image-resources';
import {bindButtonBackgrounds, buttonArtwork} from '../../assets/button-artwork';
import {imageResourceUrl} from '../../assets/image-cache';
import {loadUiFont} from './source-ui-fonts';

export const lobbyBannerUrl = '/ui/lobby/welcome-banner.webp';
export const STARTUP_UI_LAYOUTS = [
  'login.xml', 'lobby_select.xml', 'default.xml', 'roomlist.xml', 'roomlist_icon.xml',
  'playerlist.xml', 'chat.xml', 'chat_channellist_lobby.xml', 'chat_emotelist.xml',
  'chat_intimatelist.xml', 'room_main.xml', 'chat_channellist.xml',
  'game_main_chat_shrinked.xml', 'game_main_channellist.xml', 'game_main_emotelist.xml',
] as const;

export const BATTLE_UI_LAYOUTS = [
  'game_main.xml', 'game_main_info_conquer.xml', 'game_main_info_destroy.xml',
  'game_main_info_melee.xml', 'game_main_info_team.xml', 'game_main_info_vip.xml',
  'game_main_chat_shrinked.xml', 'game_main_channellist.xml', 'game_main_emotelist.xml',
  'game_main_intimatelist.xml', 'game_summary.xml', 'game_summary_award.xml',
  'game_summary_dialog.xml', 'game_summary_title.xml',
] as const;

/** Mobile HUD controls are native components; chat and settlement retain source layouts. */
export function battleUiLayouts(mobile: boolean): readonly string[] {
  return mobile ? BATTLE_UI_LAYOUTS.filter(suffix => suffix !== 'game_main.xml'
    && !suffix.startsWith('game_main_info_')) : BATTLE_UI_LAYOUTS;
}

let directory: HomeSourceUi | undefined;
let loadingDirectory: Promise<HomeSourceUi> | undefined;
const preparedLayouts = new Set<string>();
let preparationGeneration = 0;

export function loadSourceUi(): Promise<HomeSourceUi> {
  loadingDirectory ??= loadStaticJson<HomeSourceUi>('/manifests/ui.json').then(ui => {
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

/** Page sessions read an already loaded directory on their first render. */
export function cachedSourceUi(suffixes: readonly string[] = []): HomeSourceUi | undefined {
  return suffixes.every(suffix => directory?.layouts.some(layout => layout.path.endsWith(suffix)))
    ? directory : undefined;
}

/** Resolve control artwork, including hover, pushed and disabled states. */
export function sourceUiImageUrls(ui: HomeSourceUi, suffixes: readonly string[]): Set<string> {
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
  return urls;
}

/** Remove readiness for pages whose image owners have been released. */
export function forgetPreparedSourceUi(): void {
  preparationGeneration++;
  preparedLayouts.clear();
}

/** Resolve the same atlas regions as the controls, including their interaction states. */
export async function prepareSourceUi(suffixes: readonly string[], signal?: AbortSignal): Promise<HomeSourceUi> {
  signal?.throwIfAborted();
  const generation = preparationGeneration;
  const ui = await loadSourceUi();
  signal?.throwIfAborted();
  if (generation !== preparationGeneration) throw new DOMException('界面图片已释放', 'AbortError');
  const urls = sourceUiImageUrls(ui, suffixes);
  await Promise.all([loadUiFont(), ...[...urls].map(url => decodeImageRegion(url, signal))]);
  signal?.throwIfAborted();
  if (generation !== preparationGeneration) throw new DOMException('界面图片已释放', 'AbortError');
  bindButtonBackgrounds(imageResourceUrl);
  for (const suffix of suffixes) preparedLayouts.add(suffix);
  return ui;
}
