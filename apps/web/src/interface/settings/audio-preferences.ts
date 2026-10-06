export interface AudioPreferences {
  music: number;
  sound: number;
}

export const AUDIO_PREFERENCES_KEY = 'cdtank.audio-settings.v1';

function validVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Browser preferences are reconstructed; defaults come from the original audio catalog. */
export function readAudioPreferences(storage: Pick<Storage, 'getItem'>, defaults: AudioPreferences):
    {preferences: AudioPreferences; storageAvailable: boolean} {
  let raw: string | null;
  try {
    raw = storage.getItem(AUDIO_PREFERENCES_KEY);
  } catch {
    return {preferences: {...defaults}, storageAvailable: false};
  }
  let value: unknown;
  try {
    value = raw === null ? null : JSON.parse(raw);
  } catch {
    value = null;
  }
  const fields = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    preferences: {
      music: validVolume(fields.music) ? fields.music : defaults.music,
      sound: validVolume(fields.sound) ? fields.sound : defaults.sound,
    },
    storageAvailable: true,
  };
}

export function writeAudioPreferences(storage: Pick<Storage, 'setItem'>, preferences: AudioPreferences): boolean {
  if (!validVolume(preferences.music) || !validVolume(preferences.sound)) return false;
  try {
    storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
