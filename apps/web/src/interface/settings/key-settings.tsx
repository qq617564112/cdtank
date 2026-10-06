import './key-settings.css';
import {useEffect, useRef, useState} from 'react';
import type {Battle} from '../../match/battle';
import {cloneKeyBindings, DEFAULT_KEY_BINDINGS, INPUT_ACTIONS, isSupportedKeyCode, keyLabel, validateKeyBindings} from '../../match/input-bindings';
import type {InputAction, KeyBindings} from '../../match/input-bindings';
import {KEY_BINDINGS_STORAGE_KEY} from './settings-startup';

const ACTION_LABELS: Record<InputAction, string> = {
  forward: '前进', backward: '后退', turnLeft: '车体左转', turnRight: '车体右转',
  aimLeft: '炮塔左转', aimRight: '炮塔右转', fire: '开火',
  slot1: '快捷槽 1', slot2: '快捷槽 2', slot3: '快捷槽 3', slot4: '快捷槽 4',
  slot5: '快捷槽 5', slot6: '快捷槽 6', slot7: '快捷槽 7', slot8: '快捷槽 8',
};

type Capture = {action: InputAction; secondary: boolean};
export interface KeySettingsInitial {bindings: KeyBindings; loadMessage: string;}
export interface KeySettingsViewProps {
  open: boolean;
  close: () => void;
  battle: Pick<Battle, 'getKeyBindings' | 'setKeyBindings'>;
  initial: KeySettingsInitial;
  onSaved: (bindings: KeyBindings) => void;
}

/** Opening a session clones the active bindings; editing never changes gameplay. */
export function KeySettingsView({open, ...props}: KeySettingsViewProps) {
  const [loadMessage, setLoadMessage] = useState(props.initial.loadMessage);
  return open ? <KeySettingsSession {...props} initial={{...props.initial, loadMessage}}
    onSaved={bindings => {setLoadMessage(''); props.onSaved(bindings);}} /> : null;
}

function KeySettingsSession({close, battle, initial, onSaved}: Omit<KeySettingsViewProps, 'open'>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => cloneKeyBindings(battle.getKeyBindings()));
  const [capturing, setCapturing] = useState<Capture>();
  const [status, setStatus] = useState(initial.loadMessage);
  const current = useRef({draft, capturing});
  current.current = {draft, capturing};

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    const keydown = (event: KeyboardEvent) => {
      if (!element.open) return;
      const selected = current.current.capturing;
      const bindings = current.current.draft;
      // Dialog keys keep their native navigation, but cannot reach battle input.
      event.stopPropagation();
      if (event.code === 'Escape') {
        if (selected) {
          event.preventDefault();
          current.current.capturing = undefined;
          setCapturing(undefined);
          setStatus('已取消按键选择。');
        }
        return;
      }
      if (!selected || event.isComposing) return;
      if (event.repeat) {event.preventDefault(); return;}
      if (event.code === 'Tab') {
        current.current.capturing = undefined;
        setCapturing(undefined);
        return;
      }
      event.preventDefault();
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !isSupportedKeyCode(event.code)) {
        setStatus('请选择字母、数字、方向键、空格或翻页键，不能使用组合键。');
        return;
      }
      const conflict = INPUT_ACTIONS.find(action =>
        (!(action === selected.action && !selected.secondary) && bindings[action] === event.code)
        || (!(action === selected.action && selected.secondary) && bindings.secondary?.[action] === event.code));
      if (conflict) {
        const kind = bindings[conflict] === event.code ? '主键' : '备用键';
        setStatus(`该按键已用于“${ACTION_LABELS[conflict]}”${kind}，原键位保持不变。`);
        return;
      }
      const next = cloneKeyBindings(bindings);
      if (selected.secondary) {
        next.secondary ??= {};
        next.secondary[selected.action] = event.code;
      } else {
        next[selected.action] = event.code;
      }
      current.current = {draft: next, capturing: undefined};
      setDraft(next);
      setCapturing(undefined);
      setStatus('已修改草稿，点击保存后生效。');
    };
    window.addEventListener('keydown', keydown, {capture: true});
    return () => {
      window.removeEventListener('keydown', keydown, {capture: true});
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  const beginCapture = (action: InputAction, secondary: boolean) => {
    const selected = {action, secondary};
    current.current.capturing = selected;
    setCapturing(selected);
    setStatus(`请为“${ACTION_LABELS[action]}”${secondary ? '备用键' : '主键'}按新键，Esc 可取消选择。`);
  };
  const replaceDraft = (next: KeyBindings) => {
    current.current = {draft: next, capturing: undefined};
    setDraft(next);
    setCapturing(undefined);
  };
  const save = () => {
    const valid = validateKeyBindings(draft);
    if (!valid) {setStatus('键位无效或冲突，请重新选择。'); return;}
    try {
      localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(valid));
    } catch {
      setStatus('无法保存键位，当前对局键位保持不变。');
      return;
    }
    battle.setKeyBindings(valid);
    replaceDraft(cloneKeyBindings(valid));
    onSaved(valid);
    setStatus('键位已保存并生效。');
  };

  return <dialog ref={dialog} id="key-settings" aria-labelledby="key-settings-title"
    onCancel={event => {event.preventDefault(); close();}}>
    <h2 id="key-settings-title">键位设置</h2>
    <p>点击主键或备用键，再按新键；两者都可触发同一动作。备用键可清除，保存后在当前浏览器生效。</p>
    <div className="key-settings-list">
      {INPUT_ACTIONS.map(action => <div key={action}>
        <label htmlFor={`key-action-${action}`}>{ACTION_LABELS[action]}</label>
        {[false, true].map(secondary => {
          const active = capturing?.action === action && capturing.secondary === secondary;
          const code = secondary ? draft.secondary?.[action] : draft[action];
          const text = `${secondary ? '备用键' : '主键'}：${active ? '请按新键…' : code ? keyLabel(code) : '未设置'}`;
          return <button key={String(secondary)} type="button"
            id={secondary ? undefined : `key-action-${action}`}
            data-key-action={secondary ? undefined : action}
            data-secondary-key-action={secondary ? action : undefined}
            aria-label={`${ACTION_LABELS[action]} ${text}`} aria-pressed={active}
            onClick={() => beginCapture(action, secondary)}>{text}</button>;
        })}
        <button type="button" data-clear-secondary={action} disabled={!draft.secondary?.[action]}
          aria-label={`清除“${ACTION_LABELS[action]}”备用键`} onClick={() => {
            const next = cloneKeyBindings(draft);
            delete next.secondary?.[action];
            replaceDraft(next);
            setStatus(`已清除“${ACTION_LABELS[action]}”备用键草稿，点击保存后生效。`);
          }}>清除</button>
      </div>)}
    </div>
    <output id="key-settings-status" role="status">{status}</output>
    <div className="key-settings-actions">
      <button type="button" id="key-settings-defaults" onClick={() => {
        replaceDraft(cloneKeyBindings(DEFAULT_KEY_BINDINGS));
        setStatus('已恢复默认草稿，点击保存后生效。');
      }}>恢复默认</button>
      <button type="button" id="key-settings-save" onClick={save}>保存</button>
      <button type="button" id="key-settings-cancel" onClick={close}>取消</button>
    </div>
  </dialog>;
}

export function KeyBindingsHint({bindings}: {bindings: KeyBindings}) {
  const describe = (action: InputAction): string => {
    const secondary = bindings.secondary?.[action];
    return `${keyLabel(bindings[action])}${secondary ? `（备用 ${keyLabel(secondary)}）` : ''}`;
  };
  return <p id="battle-key-hint">{`${describe('forward')}/${describe('backward')} 前后移动 · `
    + `${describe('turnLeft')}/${describe('turnRight')} 转向 · `
    + `${describe('aimLeft')}/${describe('aimRight')} 炮塔转向 · ${describe('fire')} 开火`}</p>;
}
