import {gameContent} from '../../../shared/content/catalog';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {cacheImageResource} from '../assets/image-cache';
import {prepareModelResource} from '../assets/model-resources';
import {groundItemTexture} from '../assets/scenes/ground-item-visual';
import {battleResourceUrl} from '../assets/battle-artwork';

/** Prepare current ground actors and the complete drop catalog; future traps and disguises load on appearance. */
export async function prepareBattleDynamicResources(snapshot: MsgRoomSnapshot,
  onProgress: (fraction: number) => void): Promise<void> {
  const models = new Set<string>();
  const images = new Set<string>();
  const content = gameContent();
  for (const trap of snapshot.match?.groundTraps ?? []) {
    const item = content.items.get(trap.itemTableId);
    if (item?.runtime.trap && item.resources.model) {
      models.add(`/${item.resources.model}`);
      if (item.resources.texturePath) images.add(`/${item.resources.texturePath}`);
    }
  }
  for (const player of snapshot.players) {
    const roleDisguise = player.roleDisguise;
    if (!player.alive || !roleDisguise) continue;
    const item = [...content.items.values()].find(candidate => candidate.runtime.use === 'disguise'
      && candidate.runtime.skillRoles.primary === roleDisguise.skillId);
    const disguise = item?.resources.disguise;
    if (!disguise) continue;
    models.add(`/${disguise.model}`);
    for (const texture of disguise.textures) images.add(`/${texture}`);
  }
  const groundItems = snapshot.match?.groundItemResources;
  if (!groundItems) throw new Error('本局掉落物资源清单缺失');
  for (const item of groundItems) {
    models.add(`/Data/scnobj/${item.modelId}/${item.modelId}.glb`);
    images.add(`/Data/scnobj/${item.modelId}/${groundItemTexture(item.modelId, item.texture)}.webp`);
  }
  const tasks = [
    ...[...models].map(url => () => prepareModelResource(battleResourceUrl(url))),
    ...[...images].map(url => () => cacheImageResource(battleResourceUrl(url))),
  ];
  let next = 0;
  let completed = 0;
  let failure: unknown;
  onProgress(0);
  await Promise.all(Array.from({length: Math.min(4, tasks.length)}, async () => {
    while (!failure && next < tasks.length) {
      const task = tasks[next++];
      try {
        await task();
        onProgress(++completed / tasks.length);
      } catch (error) {failure = error;}
    }
  }));
  if (failure) throw failure;
  onProgress(1);
}
