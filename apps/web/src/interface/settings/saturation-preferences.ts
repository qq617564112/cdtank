import './brightness.css';

export const DEFAULT_SATURATION = 1;
export const MIN_SATURATION = 0;
export const MAX_SATURATION = 2;
const SATURATION_STORAGE_KEY = 'cdtank.saturation.v1';

let active = DEFAULT_SATURATION;

function validSaturation(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= MIN_SATURATION && value <= MAX_SATURATION;
}

export function readSaturation(storage: Pick<Storage, 'getItem'>): number {
  try {
    const raw = storage.getItem(SATURATION_STORAGE_KEY);
    if (raw === null) return DEFAULT_SATURATION;
    const value: unknown = JSON.parse(raw);
    return validSaturation(value) ? value : DEFAULT_SATURATION;
  } catch {
    return DEFAULT_SATURATION;
  }
}

export function writeSaturation(storage: Pick<Storage, 'setItem'>, value: number): boolean {
  if (!validSaturation(value)) return false;
  try {
    storage.setItem(SATURATION_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getSaturation(): number {
  return active;
}

export function applySaturation(value: number): void {
  if (!validSaturation(value)) return;
  active = value;
  document.documentElement.style.setProperty('--game-saturation', String(value));
  document.documentElement.toggleAttribute('data-game-saturation', value !== DEFAULT_SATURATION);
}
