import {useState} from 'react';
import type {Battle} from '../../match/battle';
import {writeAudioPreferences} from './audio-preferences';
import type {AudioPreferences} from './audio-preferences';
import type {InitialSettings} from './settings-startup';

export interface VolumeSettingsViewProps {
  battle: Pick<Battle, 'setMusicVolume' | 'setSoundVolume'>;
  initial: InitialSettings['audio'];
}

/**
 * The slider values are applied immediately, matching the existing audio rules;
 * browser storage only controls whether the same values survive a reload.
 */
export function VolumeSettingsView({battle, initial}: VolumeSettingsViewProps) {
  const [preferences, setPreferences] = useState<AudioPreferences>(initial.preferences);
  const [status, setStatus] = useState(initial.storageAvailable ? '' : '无法保存音量设置，刷新后将恢复默认值。');
  const update = (name: keyof AudioPreferences, value: number): void => {
    const next = {...preferences, [name]: value};
    setPreferences(next);
    if (name === 'music') battle.setMusicVolume(next.music);
    else battle.setSoundVolume(next.sound);
    const storage = {
      setItem: (key: string, serialized: string): void => window.localStorage.setItem(key, serialized),
    };
    setStatus(writeAudioPreferences(storage, next) ? '音量设置已保存。' : '无法保存音量设置，刷新后将恢复默认值。');
  };
  const percent = (value: number): string => `${Math.round(value * 100)}%`;
  return <>
    <label htmlFor="music-volume">音乐</label>
    <input id="music-volume" type="range" min="0" max="1" step="0.05" value={preferences.music}
      aria-valuetext={percent(preferences.music)} onChange={event => update('music', event.currentTarget.valueAsNumber)}/>
    <output id="music-volume-value" htmlFor="music-volume">{percent(preferences.music)}</output>
    <label htmlFor="sound-volume">音效</label>
    <input id="sound-volume" type="range" min="0" max="1" step="0.05" value={preferences.sound}
      aria-valuetext={percent(preferences.sound)} onChange={event => update('sound', event.currentTarget.valueAsNumber)}/>
    <output id="sound-volume-value" htmlFor="sound-volume">{percent(preferences.sound)}</output>
    <output id="volume-settings-status" role="status">{status}</output>
  </>;
}
