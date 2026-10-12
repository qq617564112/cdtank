import './brightness.css';

export const DEFAULT_BRIGHTNESS = 1;
export const MIN_BRIGHTNESS = .5;
export const MAX_BRIGHTNESS = 1.5;
const BRIGHTNESS_STORAGE_KEY = 'cdtank.brightness.v1';

let active = DEFAULT_BRIGHTNESS;

function validBrightness(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= MIN_BRIGHTNESS && value <= MAX_BRIGHTNESS;
}

export function readBrightness(storage: Pick<Storage, 'getItem'>): number {
  try {
    const raw = storage.getItem(BRIGHTNESS_STORAGE_KEY);
    if (raw === null) return DEFAULT_BRIGHTNESS;
    const value: unknown = JSON.parse(raw);
    return validBrightness(value) ? value : DEFAULT_BRIGHTNESS;
  } catch {
    return DEFAULT_BRIGHTNESS;
  }
}

export function writeBrightness(storage: Pick<Storage, 'setItem'>, value: number): boolean {
  if (!validBrightness(value)) return false;
  try {
    storage.setItem(BRIGHTNESS_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getBrightness(): number {
  return active;
}

export function applyBrightness(value: number): void {
  if (!validBrightness(value)) return;
  active = value;
  document.documentElement.style.setProperty('--game-brightness', String(value));
  document.documentElement.toggleAttribute('data-game-brightness', value !== DEFAULT_BRIGHTNESS);
}
