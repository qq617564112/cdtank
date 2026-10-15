export const RENDER_RESOLUTION_SCALES = [.25, .5, 1, 1.5, 2] as const;
export type RenderResolutionScale = typeof RENDER_RESOLUTION_SCALES[number];

export interface DisplayPreferences {
  renderScale: RenderResolutionScale;
  silhouette: boolean;
  msaa4x: boolean;
  motionBlur: boolean;
  showFps: boolean;
}

export const DEFAULT_DISPLAY_PREFERENCES: Readonly<DisplayPreferences> = Object.freeze({
  renderScale: 1,
  silhouette: true,
  msaa4x: false,
  motionBlur: false,
  showFps: false,
});

export const DISPLAY_PREFERENCES_STORAGE_KEY = 'cdtank.display-settings.v1';

export function getDefaultDisplayPreferences(mobile = false): DisplayPreferences {
  return {...DEFAULT_DISPLAY_PREFERENCES, renderScale: mobile ? 1.5 : 1};
}

const listeners = new Set<() => void>();
let active: Readonly<DisplayPreferences> = DEFAULT_DISPLAY_PREFERENCES;

export function validateDisplayPreferences(value: unknown): DisplayPreferences | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const fields = value as Record<string, unknown>;
  if (typeof fields.silhouette !== 'boolean') return undefined;
  const renderScale = fields.renderScale === undefined ? (fields.highPrecision === false ? .5 : 1) : fields.renderScale;
  const msaa4x = fields.msaa4x === undefined ? false : fields.msaa4x;
  const motionBlur = fields.motionBlur === undefined ? false : fields.motionBlur;
  const showFps = fields.showFps === undefined ? false : fields.showFps;
  if (!RENDER_RESOLUTION_SCALES.some(scale => scale === renderScale)
    || typeof msaa4x !== 'boolean' || typeof motionBlur !== 'boolean'
    || typeof showFps !== 'boolean') return undefined;
  return {renderScale: renderScale as RenderResolutionScale, silhouette: fields.silhouette,
    msaa4x, motionBlur, showFps};
}

export function readDisplayPreferences(storage: Pick<Storage, 'getItem'>, mobile = false):
    {preferences: DisplayPreferences; storageAvailable: boolean; loadMessage: string} {
  const defaults = getDefaultDisplayPreferences(mobile);
  let raw: string | null;
  try {
    raw = storage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY);
  } catch {
    return {
      preferences: defaults,
      storageAvailable: false,
      loadMessage: '无法读取保存的显示设置，当前使用默认显示设置。',
    };
  }
  if (raw === null) {
    return {preferences: defaults, storageAvailable: true, loadMessage: ''};
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
        preferences: defaults,
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
