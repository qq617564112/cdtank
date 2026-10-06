import './quick-chat-settings.css';
import {useEffect, useRef, useState} from 'react';
import type {Battle} from '../../match/battle';
import {DEFAULT_QUICK_CHAT_PREFERENCES, QUICK_CHAT_KEYS, validateQuickChatPreferences,
  writeQuickChatPreferences} from './quick-chat-preferences';
import type {QuickChatPreferences} from './quick-chat-preferences';
import type {InitialSettings} from './settings-startup';

export interface QuickChatSettingsViewProps {
  open: boolean;
  close: () => void;
  battle: Pick<Battle, 'setQuickChats'>;
  initial: InitialSettings['quickChat'];
}

/** A dialog session owns its draft; confirmed presets only change after storage succeeds. */
export function QuickChatSettingsView({open, ...props}: QuickChatSettingsViewProps) {
  const [confirmed, setConfirmed] = useState(props.initial);
  return open ? <QuickChatSettingsSession {...props} initial={confirmed}
    saved={preferences => setConfirmed({preferences, storageAvailable: true})} /> : null;
}

function QuickChatSettingsSession({close, battle, initial, saved}: Omit<QuickChatSettingsViewProps, 'open'> & {
  saved: (preferences: QuickChatPreferences) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<QuickChatPreferences>(initial.preferences);
  const [status, setStatus] = useState(initial.storageAvailable ? '' : '无法读取快捷聊天，当前使用空白默认内容。');

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const save = (): void => {
    const valid = validateQuickChatPreferences(draft);
    if (!valid) {
      setStatus('每条最多72字符，不能包含换行或控制字符。');
      return;
    }
    const storage = {
      setItem: (key: string, serialized: string): void => window.localStorage.setItem(key, serialized),
    };
    if (!writeQuickChatPreferences(storage, valid)) {
      setStatus('无法保存快捷聊天，当前快捷内容保持不变。');
      return;
    }
    battle.setQuickChats(valid);
    saved(valid);
    setDraft(valid);
    setStatus('快捷聊天已保存并生效。');
  };

  return <dialog ref={dialog} id="quick-chat-settings" aria-labelledby="quick-chat-settings-title"
    onCancel={event => {event.preventDefault(); close();}}
    onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <h2 id="quick-chat-settings-title">快捷聊天设置</h2>
    <p>在房间中按 F5–F12 发送对应内容，每条最多72字符。留空则不发送；编辑输入框或打开设置时不会触发。</p>
    <div className="quick-chat-settings-list">
      {QUICK_CHAT_KEYS.map(key => <div key={key}>
        <label htmlFor={`quick-chat-${key}`}>{key}</label>
        <input id={`quick-chat-${key}`} data-quick-chat-key={key} maxLength={72} autoComplete="off"
          value={draft[key]} onChange={event => {
            const value = event.currentTarget.value;
            setDraft(previous => ({...previous, [key]: value}));
          }}/>
      </div>)}
    </div>
    <output id="quick-chat-settings-status" role="status">{status}</output>
    <div className="quick-chat-settings-actions">
      <button type="button" id="quick-chat-settings-defaults" onClick={() => {
        setDraft({...DEFAULT_QUICK_CHAT_PREFERENCES});
        setStatus('已恢复空白草稿，点击保存后生效。');
      }}>恢复默认</button>
      <button type="button" id="quick-chat-settings-save" onClick={save}>保存</button>
      <button type="button" id="quick-chat-settings-cancel" onClick={close}>取消</button>
    </div>
  </dialog>;
}
