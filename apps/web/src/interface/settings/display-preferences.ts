export interface DisplayPreferences {
  highPrecision: boolean;
  silhouette: boolean;
}

export const DEFAULT_DISPLAY_PREFERENCES: Readonly<DisplayPreferences> = Object.freeze({
  highPrecision: true,
  silhouette: true,
});

export const DISPLAY_PREFERENCES_STORAGE_KEY = 'cdtank.display-settings.v1';

const listeners = new Set<() => void>();
let active: Readonly<DisplayPreferences> = DEFAULT_DISPLAY_PREFERENCES;

export function validateDisplayPreferences(value: unknown): DisplayPreferences | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const fields = value as Record<string, unknown>;
  if (typeof fields.highPrecision !== 'boolean' || typeof fields.silhouette !== 'boolean') return undefined;
  return {highPrecision: fields.highPrecision, silhouette: fields.silhouette};
}

export function readDisplayPreferences(storage: Pick<Storage, 'getItem'>):
    {preferences: DisplayPreferences; storageAvailable: boolean; loadMessage: string} {
  let raw: string | null;
  try {
    raw = storage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY);
  } catch {
    return {
      preferences: {...DEFAULT_DISPLAY_PREFERENCES},
      storageAvailable: false,
      loadMessage: '无法读取保存的显示设置，当前使用默认显示设置。',
    };
  }
  if (raw === null) {
    return {preferences: {...DEFAULT_DISPLAY_PREFERENCES}, storageAvailable: true, loadMessage: ''};
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = undefined;
  }
  const preferences = validateDisplayPreferences(value);
  return preferences
    ? {preferences, storageAvailable: true, loadMessage: ''}
    : {
        preferences: {...DEFAULT_DISPLAY_PREFERENCES},
        storageAvailable: true,
        loadMessage: '保存的显示设置无效，已恢复默认显示设置。',
      };
}

export function writeDisplayPreferences(storage: Pick<Storage, 'setItem'>,
                                         preferences: DisplayPreferences): boolean {
  const value = validateDisplayPreferences(preferences);
  if (!value) return false;
  try {
    storage.setItem(DISPLAY_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getDisplayPreferences(): Readonly<DisplayPreferences> {
  return active;
}

export function applyDisplayPreferences(preferences: DisplayPreferences): void {
  const value = validateDisplayPreferences(preferences);
  if (!value) return;
  active = Object.freeze(value);
  for (const listener of [...listeners]) listener();
}

export function subscribeDisplayPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {listeners.delete(listener);};
}
