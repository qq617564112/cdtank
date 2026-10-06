import './settings-source.css';
import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent} from 'react';
import type {Battle} from '../../match/battle';
import {cloneKeyBindings, DEFAULT_KEY_BINDINGS, INPUT_ACTIONS, isSupportedKeyCode,
  keyLabel, validateKeyBindings, type InputAction, type KeyBindings} from '../../match/input-bindings';
import {readAudioPreferences, writeAudioPreferences, type AudioPreferences} from './audio-preferences';
import {DEFAULT_QUICK_CHAT_PREFERENCES, QUICK_CHAT_KEYS, readQuickChatPreferences,
  validateQuickChatPreferences, writeQuickChatPreferences, type QuickChatPreferences} from './quick-chat-preferences';
import {KEY_BINDINGS_STORAGE_KEY, type InitialSettings} from './settings-startup';
import {SettingsSourceButton, SettingsSourcePage, SETTINGS_LAYOUT} from './settings-source-page';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {SourceImageScale} from '../resources/source-static-image';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import {SettingsResourceFeedback} from './settings-resource-feedback';

export interface SettingsSourceViewProps {
  open: boolean;
  close: () => void;
  battle: Pick<Battle, 'getKeyBindings' | 'setKeyBindings' | 'setQuickChats' | 'setMusicVolume' | 'setSoundVolume'>;
  initial: InitialSettings;
  onKeysSaved: (bindings: KeyBindings) => void;
}
const KEY_REGIONS = [
  ['forward', 'txtUp', '前进'], ['backward', 'txtDown', '后退'],
  ['turnLeft', 'txtLeft', '车体左转'], ['turnRight', 'txtRight', '车体右转'],
  ['fire', 'txtFire', '开火'], ['useItem', 'txtUseItem', '使用当前道具'],
  ['prevWeapon', 'txtPrevWeapon', '上一个武器'], ['nextWeapon', 'txtNextWeapon', '下一个武器'],
  ['prevItem', 'txtPrevItem', '上一个道具'], ['nextItem', 'txtNextItem', '下一个道具'],
] as const;
const UNSUPPORTED_OPTIONS = [
  ['rdoLow', '低画质'], ['rdoHigh', '高画质'],
  ['rdo16ColorDepth', '16位色'], ['rdo32ColorDepth', '32位色'], ['chkWaitVSync', '垂直同步'],
  ['chkSilhouette', '卡通渲染'], ['chkSoftwareCursor', '软件光标'], ['zhandoubiaoqing', '战斗表情'],
] as const;
type Capture = {action: InputAction; secondary: boolean};
const optionalPrimary = (action: InputAction): boolean => action === 'useItem' || action === 'prevWeapon'
  || action === 'nextWeapon' || action === 'prevItem' || action === 'nextItem';

export function SettingsSourceView({open, ...props}: SettingsSourceViewProps) {
  return open ? <SettingsSession {...props} /> : null;
}

function SettingsSession({battle, initial, close, onKeysSaved}: Omit<SettingsSourceViewProps, 'open'>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ui, setUi] = useState<HomeSourceUi>();
  const [resourceError, setResourceError] = useState<string>();
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  const [bindings, setBindings] = useState(() => cloneKeyBindings(battle.getKeyBindings()));
  const [quickChats, setQuickChats] = useState<QuickChatPreferences>(() => readQuickChatPreferences(localStorage).preferences);
  const [audio, setAudio] = useState<AudioPreferences>(() => readAudioPreferences(localStorage, initial.audio.preferences).preferences);
  const [capture, setCapture] = useState<Capture>();
  const composing = useRef(false), escapePending = useRef(false);
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const [displayPending, setDisplayPending] = useState(false);
  const [status, setStatus] = useState(initial.keys.loadMessage);
  const current = useRef({bindings, capture});
  current.current = {bindings, capture};

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected
          && (document.activeElement === document.body || element.contains(document.activeElement))) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    void Promise.all([fetch('/ui.json', {signal: controller.signal}), loadSourceUiFonts()]).then(async ([response]) => {
      if (!response.ok) throw new Error('设置界面资源载入失败');
      const resources = await response.json() as HomeSourceUi;
      if (!resources.layouts.some(page => page.path.endsWith(SETTINGS_LAYOUT))) throw new Error('原设置布局缺失');
      if (live) setUi(resources);
    }).catch(() => {if (live) setResourceError('设置界面资源载入失败');});
    return () => {live = false; controller.abort();};
  }, []);

  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', changed);
    changed();
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  async function changeDisplayMode(nextFullscreen: boolean, origin: HTMLButtonElement) {
    if (displayPending || nextFullscreen === !!document.fullscreenElement) return;
    setDisplayPending(true);
    try {
      if (nextFullscreen) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      setFullscreen(!!document.fullscreenElement);
    } catch {
      setStatus(nextFullscreen ? '无法进入全屏，请检查浏览器权限。' : '无法退出全屏，请使用浏览器退出全屏。');
    } finally {
      setDisplayPending(false);
      const active = document.activeElement;
      if (dialog.current?.open && origin.isConnected
          && (active === document.body || active === document.documentElement || active === dialog.current)) origin.focus();
    }
  }

  function changeAudio(name: keyof AudioPreferences, value: number) {
    const next = {...audio, [name]: value};
    setAudio(next);
    if (name === 'music') battle.setMusicVolume(value);
    else battle.setSoundVolume(value);
    setStatus(writeAudioPreferences(localStorage, next) ? '音量设置已保存。' : '无法保存音量设置，刷新后将恢复默认值。');
  }

  function save() {
    const keys = validateKeyBindings(bindings), chats = validateQuickChatPreferences(quickChats);
    if (!keys || !chats) {setStatus('键位无效或快捷聊天超过72字符。'); return;}
    try {localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(keys));}
    catch {setStatus('无法保存键位，当前键位保持不变。'); return;}
    battle.setKeyBindings(keys); onKeysSaved(keys);
    if (!writeQuickChatPreferences(localStorage, chats)) {
      setStatus('键位已保存；快捷聊天未保存，原内容保持不变。'); return;
    }
    battle.setQuickChats(chats);
    close();
  }

  function keydown(event: KeyboardEvent<HTMLDialogElement>) {
    event.stopPropagation();
    const selected = current.current.capture;
    if (event.code === 'Escape') {
      event.preventDefault();
      if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (selected) {current.current.capture = undefined; setCapture(undefined); setStatus('已取消按键选择。');}
      else escapePending.current = true;
      return;
    }
    if (!selected || event.nativeEvent.isComposing) return;
    if (event.code === 'Tab') {setCapture(undefined); return;}
    event.preventDefault();
    if (event.repeat) return;
    const controlKey = event.code === 'ControlLeft' || event.code === 'ControlRight';
    if (event.altKey || event.metaKey || event.shiftKey || (event.ctrlKey && !controlKey)
        || !isSupportedKeyCode(event.code)) {
      setStatus('请选择支持的按键，不能使用组合键。'); return;
    }
    const conflict = INPUT_ACTIONS.some(action =>
      (!(action === selected.action && !selected.secondary) && current.current.bindings[action] === event.code)
      || (!(action === selected.action && selected.secondary) && current.current.bindings.secondary?.[action] === event.code));
    if (conflict) {setStatus('该按键已用于其他动作，原键位保持不变。'); return;}
    const next = cloneKeyBindings(current.current.bindings);
    if (selected.secondary) {next.secondary ??= {}; next.secondary[selected.action] = event.code;}
    else next[selected.action] = event.code;
    current.current = {bindings: next, capture: undefined};
    setBindings(next); setCapture(undefined); setStatus('草稿已修改，确认后生效。');
  }

  const layout = ui ? new HomeSourceLayout(ui, SETTINGS_LAYOUT) : undefined;
  const props = (name: string) => sourceProps(ui!, layout!, SETTINGS_LAYOUT, name);
  function sliderStyle(source: string): CSSProperties {
    const properties = layout!.control(source).properties;
    const image = (property: string) => sourceProps(ui!, layout!, SETTINGS_LAYOUT, source, properties[property]).style.backgroundImage;
    const reference = /^set:(\S+) image:(.+)$/.exec(properties.ThumbNormalImage);
    const sets = ui!.imagesets.filter(set => set.attributes.Name === reference?.[1]);
    const set = sets.find(value => value.path.includes('imagesets_dds/')) ?? sets[0];
    const thumb = set?.images.find(value => value.Name === reference?.[2]);
    return {...props(source).style, '--settings-thumb': image('ThumbNormalImage'),
      '--settings-thumb-width': `${thumb?.Width ?? 7}px`, '--settings-thumb-height': `${thumb?.Height ?? 10}px`,
      '--settings-track-left': image('TrackLeftImage'), '--settings-track-middle': image('TrackMiddleImage'),
      '--settings-track-right': image('TrackRightImage'),
    } as CSSProperties;
  }
  return <dialog ref={dialog} id="source-settings" aria-label="系统设置" aria-busy={!ui && !resourceError} style={{zoom: scale}}
    onCompositionStart={() => {composing.current = true;}}
    onCompositionEnd={() => {composing.current = false;}}
    onCancel={event => {event.preventDefault(); if (!composing.current) close();}}
    onKeyDown={keydown} onKeyUp={event => {
      event.stopPropagation();
      if (event.code === 'Escape' && escapePending.current) {
        escapePending.current = false;
        if (!composing.current && !event.nativeEvent.isComposing) close();
      }
    }}>
    <SourceImageScale value={scale}><div className="settings-source-stage" data-settings-source-page="">
      {ui && <>
        <SettingsSourcePage ui={ui} />
        {KEY_REGIONS.flatMap(([action, region, label]) => [false, true].map(secondary => {
          const active = capture?.action === action && capture.secondary === secondary;
          const code = secondary ? bindings.secondary?.[action] : bindings[action];
          const unsetOptionalPrimary = !secondary && optionalPrimary(action) && !code;
          return <button key={region + Number(secondary)} {...props(region + Number(secondary))} type="button"
            className="settings-key" data-settings-key={action} data-settings-secondary={String(secondary)}
            data-settings-unset={unsetOptionalPrimary ? '' : undefined}
            title={unsetOptionalPrimary ? '未设置' : undefined}
            aria-label={`${label}${secondary ? '备用键' : '主键'}${unsetOptionalPrimary ? '，未设置' : ''}`}
            aria-pressed={active}
            onClick={() => {current.current.capture = {action, secondary}; setCapture({action, secondary}); setStatus('请按新键；Esc取消选择。');}}
            onContextMenu={event => {
              event.preventDefault(); if (!secondary) return;
              const next = cloneKeyBindings(bindings); delete next.secondary?.[action]; setBindings(next); setCapture(undefined);
            }}>{active ? '按新键' : code ? keyLabel(code) : unsetOptionalPrimary ? '未设置' : ''}</button>;
        }))}
        {QUICK_CHAT_KEYS.map(key => <input key={key} {...props('edt' + key)} className="settings-quick-chat"
          aria-label={key + '快捷聊天'} data-settings-quick-chat={key} value={quickChats[key]} maxLength={72}
          autoComplete="off" onChange={event => setQuickChats({...quickChats, [key]: event.currentTarget.value})} />)}
        {(['music', 'sound'] as const).map(name => <input key={name}
          {...props(name === 'music' ? 'sldMusicVolume' : 'sldSoundVolume')} type="range" min="0" max="1" step="0.05"
          className="settings-volume" data-settings-volume={name} aria-label={name === 'music' ? '音乐音量' : '音效音量'}
          aria-valuetext={`${Math.round(audio[name] * 100)}%`} value={audio[name]}
          style={sliderStyle(name === 'music' ? 'sldMusicVolume' : 'sldSoundVolume')}
          onChange={event => changeAudio(name, event.currentTarget.valueAsNumber)} />)}
        {([['window', 'rdoWindowMode', '窗口模式'], ['fullscreen', 'rdoFullscreenMode', '全屏模式']] as const)
          .map(([mode, source, label]) => <SettingsSourceButton key={source} ui={ui} source={source}
            data-settings-display-mode={mode} data-settings-display-binding="web-browser-fullscreen"
            aria-label={label} aria-pressed={mode === 'fullscreen' ? fullscreen : !fullscreen}
            selected={mode === 'fullscreen' ? fullscreen : !fullscreen}
            aria-busy={displayPending}
            disabled={mode === 'fullscreen' && !document.fullscreenEnabled}
            onClick={event => {void changeDisplayMode(mode === 'fullscreen', event.currentTarget);}} />)}
        {UNSUPPORTED_OPTIONS.map(([source, label]) => <SettingsSourceButton key={source} ui={ui} source={source}
          disabled aria-label={label} title="尚未接入" />)}
        <SettingsSourceButton ui={ui} source="btnOK" aria-label="确认设置" data-settings-confirm="" onClick={save} />
        <SettingsSourceButton ui={ui} source="btnDefault" aria-label="恢复默认草稿" data-settings-default=""
          onClick={() => {setBindings(cloneKeyBindings(DEFAULT_KEY_BINDINGS)); setQuickChats({...DEFAULT_QUICK_CHAT_PREFERENCES});
            setCapture(undefined); setStatus('已恢复默认草稿，确认后生效。');}} />
        <SettingsSourceButton ui={ui} source="btnCancel" aria-label="取消设置" data-settings-cancel="" onClick={close} />
        <SettingsSourceButton ui={ui} source="btnClose" aria-label="关闭设置" data-settings-close="" onClick={close} />
      </>}
      {ui && <output className="settings-status" role="status" data-settings-status="">{status}</output>}
      {!ui && <SettingsResourceFeedback error={resourceError} close={close} />}
    </div></SourceImageScale>
  </dialog>;
}
