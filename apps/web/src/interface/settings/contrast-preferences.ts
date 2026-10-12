import './brightness.css';

export const DEFAULT_CONTRAST = 1;
export const MIN_CONTRAST = .5;
export const MAX_CONTRAST = 1.5;
const CONTRAST_STORAGE_KEY = 'cdtank.contrast.v1';

let active = DEFAULT_CONTRAST;

function validContrast(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= MIN_CONTRAST && value <= MAX_CONTRAST;
}

export function readContrast(storage: Pick<Storage, 'getItem'>): number {
  try {
    const raw = storage.getItem(CONTRAST_STORAGE_KEY);
    if (raw === null) return DEFAULT_CONTRAST;
    const value: unknown = JSON.parse(raw);
    return validContrast(value) ? value : DEFAULT_CONTRAST;
  } catch {
    return DEFAULT_CONTRAST;
  }
}

export function writeContrast(storage: Pick<Storage, 'setItem'>, value: number): boolean {
  if (!validContrast(value)) return false;
  try {
    storage.setItem(CONTRAST_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getContrast(): number {
  return active;
}

export function applyContrast(value: number): void {
  if (!validContrast(value)) return;
  active = value;
  document.documentElement.style.setProperty('--game-contrast', String(value));
  document.documentElement.toggleAttribute('data-game-contrast', value !== DEFAULT_CONTRAST);
}
