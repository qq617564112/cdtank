export const QUICK_CHAT_KEYS = ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'] as const;
export type QuickChatKey = typeof QUICK_CHAT_KEYS[number];
export type QuickChatPreferences = Record<QuickChatKey, string>;

export const QUICK_CHAT_PREFERENCES_KEY = 'cdtank.quick-chat-settings.v1';
/** The original Config/SystemSetting.ini has eight empty QuickChat fields. */
export const DEFAULT_QUICK_CHAT_PREFERENCES: Readonly<QuickChatPreferences> = {
  F5: '', F6: '', F7: '', F8: '', F9: '', F10: '', F11: '', F12: '',
};

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 72 && !/[\u0000-\u001f\u007f]/.test(value);
}

export function validateQuickChatPreferences(value: unknown): QuickChatPreferences | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const fields = value as Record<string, unknown>;
  const preferences = {...DEFAULT_QUICK_CHAT_PREFERENCES};
  for (const key of QUICK_CHAT_KEYS) {
    if (!validText(fields[key])) return undefined;
    preferences[key] = fields[key];
  }
  return preferences;
}

/** Restore each valid field independently; browser persistence is reconstructed. */
export function readQuickChatPreferences(storage: Pick<Storage, 'getItem'>):
    {preferences: QuickChatPreferences; storageAvailable: boolean} {
  let raw: string | null;
  try {
    raw = storage.getItem(QUICK_CHAT_PREFERENCES_KEY);
  } catch {
    return {preferences: {...DEFAULT_QUICK_CHAT_PREFERENCES}, storageAvailable: false};
  }
  let value: unknown;
  try {
    value = raw === null ? null : JSON.parse(raw);
  } catch {
    value = null;
  }
  const fields = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const preferences = {...DEFAULT_QUICK_CHAT_PREFERENCES};
  for (const key of QUICK_CHAT_KEYS) {
    if (validText(fields[key])) preferences[key] = fields[key];
  }
  return {preferences, storageAvailable: true};
}

export function writeQuickChatPreferences(storage: Pick<Storage, 'setItem'>,
                                         preferences: QuickChatPreferences): boolean {
  const valid = validateQuickChatPreferences(preferences);
  if (!valid) return false;
  try {
    storage.setItem(QUICK_CHAT_PREFERENCES_KEY, JSON.stringify(valid));
    return true;
  } catch {
    return false;
  }
}
