export type BattleArtworkQuality = 'original' | 'hd';

export const DEFAULT_BATTLE_ARTWORK_QUALITY: BattleArtworkQuality = 'hd';
const STORAGE_KEY = 'cdtank.battle-artwork.v1';
let active: BattleArtworkQuality = DEFAULT_BATTLE_ARTWORK_QUALITY;

export function getBattleArtworkQuality(): BattleArtworkQuality {
  return active;
}

export function readBattleArtworkQuality(storage: Pick<Storage, 'getItem'>):
  {quality: BattleArtworkQuality; loadMessage: string} {
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (value === 'original' || value === 'hd') return {quality: value, loadMessage: ''};
    return {quality: DEFAULT_BATTLE_ARTWORK_QUALITY,
      loadMessage: value === null ? '' : '保存的战斗素材设置无效，已恢复HD画质。'};
  } catch {
    return {quality: DEFAULT_BATTLE_ARTWORK_QUALITY, loadMessage: '无法读取战斗素材设置，当前使用HD画质。'};
  }
}

export function initializeBattleArtworkQuality(storage: Pick<Storage, 'getItem'>): void {
  active = readBattleArtworkQuality(storage).quality;
}

export function writeBattleArtworkQuality(storage: Pick<Storage, 'setItem'>, quality: BattleArtworkQuality): boolean {
  try {
    storage.setItem(STORAGE_KEY, quality);
    return true;
  } catch {
    return false;
  }
}
