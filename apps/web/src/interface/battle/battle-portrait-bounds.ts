import type {PortraitState} from './portrait-state';

const PET_IDS = new Set([1, 2, 3, 4, 5, 101, 102, 103, 104, 105]);

/** Each complete sprite is registered to the original 58×53 portrait frame. */
export const BATTLE_REMOTE_PORTRAITS = {
  friend: {x: -15, y: -30, width: 100, height: 100},
  enemy: {x: -8, y: -30, width: 100, height: 100},
};

export function battleRemotePortraitAsset(petId: number | undefined,
  expression: ReturnType<PortraitState['image']>, enemy: boolean): string | undefined {
  const tone = enemy ? 'red' : 'blue';
  if (expression === 'dead') return `ui/battle/portraits/framed/dead-${tone}.webp`;
  if (petId === undefined || !PET_IDS.has(petId)) return;
  return `ui/battle/portraits/framed/pet-${petId}-${expression}-${tone}.webp`;
}
