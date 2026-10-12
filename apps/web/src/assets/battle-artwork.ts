import type {Scene} from '@babylonjs/core';
import {getBattleArtworkQuality, initializeBattleArtworkQuality} from '../interface/settings/battle-artwork-preferences';
import {loadStaticJson} from './static-resources';

interface BattleArtworkManifest {
  variants: {original: Record<string, string>; hd: Record<string, string>};
}

const battleScenes = new WeakSet<Scene>();
let manifest: BattleArtworkManifest | undefined;

/** Resolve source asset identifiers before previews or battles load models. */
export async function prepareArtworkManifest(): Promise<void> {
  manifest = await loadStaticJson<BattleArtworkManifest>('/manifests/battle-artwork.json');
}

/** Preview scenes and UI retain their current artwork. */
export async function prepareBattleArtwork(scene: Scene): Promise<void> {
  initializeBattleArtworkQuality({getItem: key => window.localStorage.getItem(key)});
  await prepareArtworkManifest();
  battleScenes.add(scene);
}

export function battleArtworkUrl(url: string, scene: Scene): string {
  return artworkUrl(url, battleScenes.has(scene) ? getBattleArtworkQuality() : 'hd');
}

/** Dynamic actors are prepared before their first instance in the battle scene. */
export function battleResourceUrl(url: string): string {
  return artworkUrl(url, getBattleArtworkQuality());
}

function artworkUrl(url: string, quality: 'original' | 'hd'): string {
  if (!manifest) return url;
  const address = new URL(url, location.href);
  if (address.origin !== location.origin) return url;
  const selected = manifest.variants[quality][decodeURIComponent(address.pathname)];
  return selected ? selected + address.search + address.hash : url;
}
