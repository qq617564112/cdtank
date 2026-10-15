import type {Scene} from '@babylonjs/core';
import {getBattleArtworkQuality, initializeBattleArtworkQuality} from '../interface/settings/battle-artwork-preferences';
import {loadStaticJson} from './static-resources';
import {isMobileDevice} from '../platform/device';

interface BattleArtworkManifest {
  variants: Record<'original' | 'hd' | 'mobile-hd', Record<string, string>>;
}

const battleScenes = new WeakSet<Scene>();
let manifest: BattleArtworkManifest | undefined;

/** Resolve source asset identifiers before previews or battles load models. */
export async function prepareArtworkManifest(): Promise<void> {
  manifest = await loadStaticJson<BattleArtworkManifest>('/manifests/battle-artwork.json');
  if (isMobileDevice() && (!manifest.variants.original || !manifest.variants['mobile-hd'])) {
    throw new Error('缺少移动端战斗材质包，请更新游戏资源。');
  }
}

/** Preview scenes and UI retain their current artwork. */
export async function prepareBattleArtwork(scene: Scene): Promise<void> {
  initializeBattleArtworkQuality({getItem: key => window.localStorage.getItem(key)});
  await prepareArtworkManifest();
  battleScenes.add(scene);
}

export function battleArtworkUrl(url: string, scene: Scene): string {
  return artworkUrl(url, battleScenes.has(scene) ? activeBattleQuality() : 'hd');
}

/** Dynamic actors are prepared before their first instance in the battle scene. */
export function battleResourceUrl(url: string): string {
  return artworkUrl(url, activeBattleQuality());
}

export function activeBattleQuality(): 'original' | 'hd' {
  return getBattleArtworkQuality();
}

function artworkUrl(url: string, quality: 'original' | 'hd'): string {
  if (!manifest) return url;
  const address = new URL(url, location.href);
  if (address.origin !== location.origin) return url;
  const variant = quality === 'hd' && isMobileDevice() ? 'mobile-hd' : quality;
  const selected = manifest.variants[variant][decodeURIComponent(address.pathname)];
  return selected ? selected + address.search + address.hash : url;
}
