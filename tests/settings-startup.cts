import assert from 'node:assert/strict';
import {initializeSettings, KEY_BINDINGS_STORAGE_KEY} from '../apps/web/src/interface/settings/settings-startup';
import {DEFAULT_KEY_BINDINGS} from '../apps/web/src/match/input-bindings';
import {AUDIO_PREFERENCES_KEY} from '../apps/web/src/interface/settings/audio-preferences';
import {DEFAULT_QUICK_CHAT_PREFERENCES, QUICK_CHAT_PREFERENCES_KEY} from '../apps/web/src/interface/settings/quick-chat-preferences';

const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
const calls: [string, unknown][] = [];
const battle = {
  setKeyBindings: (value: typeof DEFAULT_KEY_BINDINGS) => {calls.push(['keys', value]);},
  setQuickChats: (value: typeof DEFAULT_QUICK_CHAT_PREFERENCES) => {calls.push(['chat', value]);},
  setMusicVolume: (value: number) => {calls.push(['music', value]);},
  setSoundVolume: (value: number) => {calls.push(['sound', value]);},
};
try {
  const bindings = {...DEFAULT_KEY_BINDINGS, forward: 'KeyI'};
  const chat = {...DEFAULT_QUICK_CHAT_PREFERENCES, F5: '一起出发'};
  const data = new Map([[KEY_BINDINGS_STORAGE_KEY, JSON.stringify(bindings)],
    [QUICK_CHAT_PREFERENCES_KEY, JSON.stringify(chat)], [AUDIO_PREFERENCES_KEY, '{"music":0,"sound":0.25}']]);
  Object.defineProperty(globalThis, 'window', {configurable: true, value: {localStorage: {getItem: (key: string) => data.get(key) ?? null}}});
  const initial = initializeSettings(battle);
  assert.deepEqual(calls, [['keys', bindings], ['chat', chat], ['music', 0], ['sound', 0.25]], 'all consumers are restored before initializer returns');
  assert.deepEqual(initial.audio.preferences, {music: 0, sound: 0.25});
  calls.length = 0;
  Object.defineProperty(globalThis, 'window', {configurable: true, value: {get localStorage(): never {throw new Error('SecurityError');}}});
  const unavailable = initializeSettings(battle);
  assert.deepEqual(calls, [['keys', DEFAULT_KEY_BINDINGS], ['chat', DEFAULT_QUICK_CHAT_PREFERENCES], ['music', 0.5], ['sound', 0.5]]);
  assert.equal(unavailable.audio.storageAvailable, false);
  assert.equal(unavailable.quickChat.storageAvailable, false);
  assert.match(unavailable.keys.loadMessage, /无法读取/);
  console.log('PASS: settings restore consumers synchronously, preserve mute and handle unavailable storage');
} finally {
  if (original) Object.defineProperty(globalThis, 'window', original);
  else Reflect.deleteProperty(globalThis, 'window');
}
