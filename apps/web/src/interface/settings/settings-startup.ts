import type {Battle} from '../../match/battle';
import {cloneKeyBindings, DEFAULT_KEY_BINDINGS, validateKeyBindings} from '../../match/input-bindings';
import {readAudioPreferences} from './audio-preferences';
import {readQuickChatPreferences} from './quick-chat-preferences';

export const KEY_BINDINGS_STORAGE_KEY = 'cdtank.key-bindings.v1';

/** Restore consumers before React can expose room entry or playback controls. */
export function initializeSettings(battle: Pick<Battle, 'setKeyBindings' | 'setQuickChats' | 'setMusicVolume' | 'setSoundVolume'>) {
  const storage = {getItem: (key: string) => window.localStorage.getItem(key)};
  const audio = readAudioPreferences(storage, {music: 0.5, sound: 0.5});
  const quickChat = readQuickChatPreferences(storage);
  let bindings = cloneKeyBindings(DEFAULT_KEY_BINDINGS);
  let loadMessage = '';
  try {
    const raw = storage.getItem(KEY_BINDINGS_STORAGE_KEY);
    if (raw !== null) {
      const saved = validateKeyBindings(JSON.parse(raw));
      if (saved) bindings = saved;
      else loadMessage = '保存的键位无效，已恢复默认键位。';
    }
  } catch {
    loadMessage = '无法读取保存的键位，当前使用默认键位。';
  }
  battle.setKeyBindings(bindings);
  battle.setQuickChats(quickChat.preferences);
  battle.setMusicVolume(audio.preferences.music);
  battle.setSoundVolume(audio.preferences.sound);
  return {keys: {bindings, loadMessage}, quickChat, audio};
}

export type InitialSettings = ReturnType<typeof initializeSettings>;
