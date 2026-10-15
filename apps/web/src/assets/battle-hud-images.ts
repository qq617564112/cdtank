import {decodeImage} from './image-resources';

export const BATTLE_WOOD_PANEL_ARTWORK = {
  spectator: '/ui/battle/spectator-board-v2.png',
  score: '/ui/lobby/hall-plaque.png',
  timer: '/ui/lobby/room-name-plaque.png',
};

/** Complete panel images are ready before combat can display them for the first time. */
export async function prepareBattlePanelImages(signal: AbortSignal): Promise<void> {
  await Promise.all(Object.values(BATTLE_WOOD_PANEL_ARTWORK).map(url => decodeImage(url, signal)));
}
