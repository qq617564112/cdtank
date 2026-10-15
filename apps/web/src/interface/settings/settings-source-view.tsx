import {fullPageScale, MOBILE_PAGE, subscribeGamePageViewport} from '../../platform/page-viewport';
import {GameMessage} from '../resources/game-message';
import {playButtonSound} from '../../audio/button-sound';
import './settings-source.css';
import {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import type {Battle} from '../../match/battle';
import {cloneKeyBindings, DEFAULT_KEY_BINDINGS, INPUT_ACTIONS, isSupportedKeyCode,
  keyLabel, validateKeyBindings, type InputAction, type KeyBindings} from '../../match/input-bindings';
import {readAudioPreferences, writeAudioPreferences, type AudioPreferences} from './audio-preferences';
import {applyDisplayPreferences, getDefaultDisplayPreferences, getDisplayPreferences,
  RENDER_RESOLUTION_SCALES, validateDisplayPreferences, writeDisplayPreferences,
  type DisplayPreferences, type RenderResolutionScale} from './display-preferences';
import {KEY_BINDINGS_STORAGE_KEY, type InitialSettings} from './settings-startup';
import {SettingsSourceButton, SettingsSourcePage, SETTINGS_LAYOUT} from './settings-source-page';
import {SettingsAdjustment, SettingsChoice, SettingsKeyField} from './settings-controls';
import {applyBrightness, DEFAULT_BRIGHTNESS, getBrightness, MIN_BRIGHTNESS, MAX_BRIGHTNESS,
  writeBrightness} from './brightness-preferences';
import {applySaturation, DEFAULT_SATURATION, getSaturation, MIN_SATURATION, MAX_SATURATION,
  writeSaturation} from './saturation-preferences';
import {applyContrast, DEFAULT_CONTRAST, getContrast, MIN_CONTRAST, MAX_CONTRAST,
  writeContrast} from './contrast-preferences';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {SourceImageScale} from '../resources/source-static-image';
import {cachedSourceUi, loadSourceUi} from '../resources/source-ui-resources';
import {SettingsResourceFeedback} from './settings-resource-feedback';
import {GameDialog} from '../resources/game-dialog';
import {GameButton} from '../resources/game-button';
import {DEFAULT_BATTLE_ARTWORK_QUALITY, getBattleArtworkQuality, writeBattleArtworkQuality,
  type BattleArtworkQuality} from './battle-artwork-preferences';
import {isMobileDevice} from '../../platform/device';

export interface SettingsSourceViewProps {
  open: boolean;
  close: () => void;
  battle: Pick<Battle, 'getKeyBindings' | 'setKeyBindings' | 'setMusicVolume' | 'setSoundVolume'>;
  initial: InitialSettings;
  onKeysSaved: (bindings: KeyBindings) => void;
}
const KEY_ROWS = [
  ['forward', '前进'], ['backward', '后退'],
  ['turnLeft', '车身左转'], ['turnRight', '车身右转'],
  ['aimLeft', '炮塔左转'], ['aimRight', '炮塔右转'], ['scoreboard', '计分板'],
  ['fire', '发炮'], ['useItem', '道具使用'],
  ['prevWeapon', '前一个炮弹'], ['nextWeapon', '后一个炮弹'],
  ['prevItem', '前一个道具'], ['nextItem', '后一个道具'],
] as const satisfies readonly (readonly [InputAction, string])[];
type Capture = {action: InputAction; secondary: boolean};
const optionalPrimary = (action: InputAction): boolean => action === 'useItem' || action === 'prevWeapon'
  || action === 'nextWeapon' || action === 'prevItem' || action === 'nextItem';

export function SettingsSourceView({open, ...props}: SettingsSourceViewProps) {
  return open ? <SettingsSession {...props} /> : null;
}

function SettingsSession({battle, initial, close, onKeysSaved}: Omit<SettingsSourceViewProps, 'open'>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ui, setUi] = useState<HomeSourceUi | undefined>(() => cachedSourceUi([SETTINGS_LAYOUT]));
  const [resourceError, setResourceError] = useState<string>();
  const [resourceAttempt, setResourceAttempt] = useState(0);
  const [scale, setScale] = useState(() => fullPageScale());
  const [mobileTab, setMobileTab] = useState<'display' | 'keys'>('display');
  const [bindings, setBindings] = useState(() => cloneKeyBindings(battle.getKeyBindings()));
  const [audio, setAudio] = useState<AudioPreferences>(() => readAudioPreferences(localStorage, initial.audio.preferences).preferences);
  const [brightness, setBrightness] = useState(getBrightness);
  const [saturation, setSaturation] = useState(getSaturation);
  const [contrast, setContrast] = useState(getContrast);
  const [display, setDisplay] = useState<DisplayPreferences>(() => ({...getDisplayPreferences()}));
  const savedSettings = useRef({audio, brightness, saturation, contrast, display});
  const initialMsaa4x = useRef(display.msaa4x);
  const [artworkQuality, setArtworkQuality] = useState<BattleArtworkQuality>(getBattleArtworkQuality);
  const [capture, setCapture] = useState<Capture>();
  const composing = useRef(false), escapePending = useRef(false);
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const [displayPending, setDisplayPending] = useState(false);
  const [status, setStatus] = useState(() =>
    [initial.keys.loadMessage, initial.display.loadMessage, initial.artwork.loadMessage].filter(Boolean).join(' '));
  const current = useRef({bindings, capture});
  current.current = {bindings, capture};

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    element.showModal();
    const resize = () => setScale(fullPageScale());
    const unsubscribeViewport = subscribeGamePageViewport(resize);
    return () => {
      unsubscribeViewport();
      if (element.open) element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected
          && (document.activeElement === document.body || element.contains(document.activeElement))) previousFocus.focus();
    };
  }, []);

  useEffect(() => () => {
    const saved = savedSettings.current;
    battle.setMusicVolume(saved.audio.music);
    battle.setSoundVolume(saved.audio.sound);
    applyBrightness(saved.brightness);
    applySaturation(saved.saturation);
    applyContrast(saved.contrast);
    applyDisplayPreferences(saved.display);
  }, [battle]);

  useEffect(() => {
    let live = true;
    setResourceError(undefined);
    void document.fonts.load('16px "HappyZcool-2016"').catch(() => {});
    void loadSourceUi().then(resources => {
      if (!resources.layouts.some(page => page.path.endsWith(SETTINGS_LAYOUT))) throw new Error('原设置布局缺失');
      if (live) setUi(resources);
    }).catch(() => {if (live) setResourceError('设置界面资源载入失败，请重试。');});
    return () => {live = false;};
  }, [resourceAttempt]);

  async function applyDisplayMode(origin: HTMLButtonElement): Promise<boolean> {
    if (fullscreen === !!document.fullscreenElement) return true;
    setDisplayPending(true);
    try {
      if (fullscreen) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      return true;
    } catch {
      setStatus(fullscreen ? '无法进入全屏，请检查浏览器权限。' : '无法退出全屏，请使用浏览器退出全屏。');
      return false;
    } finally {
      setDisplayPending(false);
      const active = document.activeElement;
      if (dialog.current?.open && origin.isConnected
          && (active === document.body || active === document.documentElement || active === dialog.current)) origin.focus();
    }
  }

  function changeAudio(name: keyof AudioPreferences, value: number) {
    setAudio(previous => ({...previous, [name]: value}));
    if (name === 'music') battle.setMusicVolume(value);
    else battle.setSoundVolume(value);
    setStatus('');
  }

  function changeBrightness(value: number) {
    setBrightness(value);
    applyBrightness(value);
    setStatus('');
  }

  function changeSaturation(value: number) {
    setSaturation(value);
    applySaturation(value);
    setStatus('');
  }

  function changeContrast(value: number) {
    setContrast(value);
    applyContrast(value);
    setStatus('');
  }

  function changeDisplay(preferences: DisplayPreferences) {
    setDisplay(preferences);
    // MSAA changes require a client reload after confirmation.
    applyDisplayPreferences({...preferences, msaa4x: getDisplayPreferences().msaa4x});
    setStatus('');
  }

  function changeRenderScale(renderScale: RenderResolutionScale) {
    changeDisplay({...display, renderScale});
  }

  function beginCapture(action: InputAction, secondary: boolean) {
    const selected = {action, secondary};
    current.current.capture = selected;
    setCapture(selected);
    setStatus('请按新键；Esc取消选择。');
  }

  function restoreDefaults() {
    const next = cloneKeyBindings(DEFAULT_KEY_BINDINGS);
    current.current = {bindings: next, capture: undefined};
    setBindings(next);
    changeAudio('music', .5);
    changeAudio('sound', .5);
    changeDisplay(getDefaultDisplayPreferences());
    setFullscreen(false);
    setArtworkQuality(DEFAULT_BATTLE_ARTWORK_QUALITY);
    setCapture(undefined);
    changeBrightness(DEFAULT_BRIGHTNESS);
    changeSaturation(DEFAULT_SATURATION);
    changeContrast(DEFAULT_CONTRAST);
    setStatus('已预览默认设置，点击确定保存。');
  }

  async function save(origin: HTMLButtonElement) {
    if (displayPending) return;
    const keys = validateKeyBindings(bindings);
    const displayPreferences = validateDisplayPreferences(display);
    if (!keys) {setStatus('键位无效。'); return;}
    if (!displayPreferences) {setStatus('显示设置无效，请重新调整。'); return;}
    if (!await applyDisplayMode(origin)) return;
    if (!dialog.current?.open) return;
    try {localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(keys));}
    catch {setStatus('无法保存键位，当前键位保持不变。'); return;}
    battle.setKeyBindings(keys); onKeysSaved(keys);
    if (!writeAudioPreferences(localStorage, audio)) {
      setStatus('音量设置未保存，请重试。'); return;
    }
    savedSettings.current.audio = audio;
    battle.setMusicVolume(audio.music);
    battle.setSoundVolume(audio.sound);
    if (!writeBrightness(localStorage, brightness)) {
      setStatus('亮度设置未保存，请重试。'); return;
    }
    savedSettings.current.brightness = brightness;
    applyBrightness(brightness);
    if (!writeSaturation(localStorage, saturation)) {
      setStatus('饱和度设置未保存，请重试。'); return;
    }
    savedSettings.current.saturation = saturation;
    applySaturation(saturation);
    if (!writeContrast(localStorage, contrast)) {
      setStatus('对比度设置未保存，请重试。'); return;
    }
    savedSettings.current.contrast = contrast;
    applyContrast(contrast);
    if (!writeDisplayPreferences(localStorage, displayPreferences)) {
      setStatus('显示设置未保存，请重试。'); return;
    }
    savedSettings.current.display = displayPreferences;
    applyDisplayPreferences(displayPreferences);
    const antialiasChanged = displayPreferences.msaa4x !== initialMsaa4x.current;
    const artworkSaved = writeBattleArtworkQuality(localStorage, artworkQuality);
    if (!artworkSaved) {
      setStatus('显示设置已保存，战斗素材设置未保存，请重试。'); return;
    }
    if (antialiasChanged || artworkQuality !== getBattleArtworkQuality()) {
      window.location.reload();
      return;
    }
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
  const props = (name: string, offsetY = -54) => sourceProps(ui!, layout!, SETTINGS_LAYOUT, name,
    undefined, 0, offsetY);
  return <GameDialog ref={dialog} id="source-settings" width={isMobileDevice() ? MOBILE_PAGE.width : 800}
    height={isMobileDevice() ? MOBILE_PAGE.height : 599} stageClassName="settings-source-stage"
    aria-label="系统设置" aria-busy={!ui && !resourceError} data-settings-source-page="" uiScale={scale}
    data-mobile-settings-tab={mobileTab}
    onCompositionStart={() => {composing.current = true;}}
    onCompositionEnd={() => {composing.current = false;}}
    onCancel={event => {event.preventDefault(); if (!composing.current && !displayPending) close();}}
    onKeyDown={keydown} onKeyUp={event => {
      event.stopPropagation();
      if (event.code === 'Escape' && escapePending.current) {
        escapePending.current = false;
        if (!composing.current && !event.nativeEvent.isComposing && !displayPending) close();
      }
    }}>
    <SourceImageScale value={scale}>
      {ui && <>
        <SettingsSourcePage ui={ui}
          topbar={<SettingsSourceButton ui={ui} source="btnClose" offsetX={-41} offsetY={-5}
            aria-label="关闭设置" data-settings-close="" disabled={displayPending} onClick={close} />}
          footbar={<>
            <SettingsSourceButton ui={ui} source="btnDefault" offsetX={-76} offsetY={-548}
              aria-label="恢复默认设置" data-settings-default=""
              disabled={displayPending} onClick={restoreDefaults} />
            <SettingsSourceButton ui={ui} source="btnOK" offsetX={-76} offsetY={-548}
              aria-label="确认设置" data-settings-confirm="" disabled={displayPending}
              onClick={event => {void save(event.currentTarget);}} />
            <SettingsSourceButton ui={ui} source="btnCancel" offsetX={-76} offsetY={-548}
              aria-label="取消设置" data-settings-cancel="" disabled={displayPending} onClick={close} />
          </>} />
        {isMobileDevice() && <nav className="mobile-settings-tabs" aria-label="设置分类">
          <GameButton aria-pressed={mobileTab === 'display'} onClick={() => setMobileTab('display')}>画面与声音</GameButton>
          <GameButton aria-pressed={mobileTab === 'keys'} onClick={() => setMobileTab('keys')}>键位设置</GameButton>
        </nav>}
        <div className="settings-key-headings" aria-hidden="true"><span>主键</span><span>备用键</span></div>
        <div className="settings-key-list" role="group" aria-label="键位设置">
          {KEY_ROWS.map(([action, label]) => <div key={action} className="settings-key-row">
            <label className="settings-art-label settings-key-label" htmlFor={`settings-key-${action}`}>{label}</label>
            {[false, true].map(secondary => {
              const active = capture?.action === action && capture.secondary === secondary;
              const code = secondary ? bindings.secondary?.[action] : bindings[action];
              const unsetOptionalPrimary = !secondary && optionalPrimary(action) && !code;
              return <SettingsKeyField key={String(secondary)} active={active}
                disabled={displayPending}
                id={`settings-key-${action}${secondary ? '-secondary' : ''}`}
                data-settings-key={action} data-settings-secondary={String(secondary)}
                data-settings-unset={unsetOptionalPrimary ? '' : undefined}
                aria-label={`${label}${secondary ? '备用键' : '主键'}${active ? '，请按新键' : !code ? '，未设置' : ''}`}
                title="点击或按Enter设置；Esc取消选择；右键清除备用键"
                value={active ? '按新键' : code ? keyLabel(code) : unsetOptionalPrimary ? '未设置' : ''}
                onClick={() => beginCapture(action, secondary)}
                onKeyDown={event => {
                  if (!current.current.capture && event.code === 'Enter') {
                    event.preventDefault(); event.stopPropagation(); playButtonSound(); beginCapture(action, secondary);
                  }
                }}
                onBlur={() => {
                  const selected = current.current.capture;
                  if (selected?.action === action && selected.secondary === secondary) {
                    current.current.capture = undefined; setCapture(undefined); setStatus('已取消按键选择。');
                  }
                }}
                onContextMenu={event => {
                  event.preventDefault(); if (!secondary) return;
                  const next = cloneKeyBindings(current.current.bindings);
                  delete next.secondary?.[action];
                  current.current = {bindings: next, capture: undefined};
                  setBindings(next); setCapture(undefined); setStatus('备用键已清除，确认后生效。');
                }}/>
            })}
          </div>)}
        </div>
        <div className="settings-adjustments" role="group" aria-label="音量与画面调节">
          <SettingsAdjustment icon="/ui/settings/music-cat.png" label="音乐音量" data-settings-volume="music"
            disabled={displayPending}
            value={audio.music} onValueChange={value => changeAudio('music', value)}/>
          <SettingsAdjustment icon="/ui/settings/sound-dog.png" label="音效音量" data-settings-volume="sound"
            disabled={displayPending}
            value={audio.sound} onValueChange={value => changeAudio('sound', value)}/>
          <SettingsAdjustment icon="/ui/settings/brightness-shiba-label.webp" label="亮度" data-settings-brightness=""
            disabled={displayPending}
            min={MIN_BRIGHTNESS} max={MAX_BRIGHTNESS} value={brightness} onValueChange={changeBrightness}/>
          <SettingsAdjustment icon="/ui/settings/saturation-husky.webp" label="饱和度"
            disabled={displayPending}
            data-settings-saturation="" min={MIN_SATURATION} max={MAX_SATURATION}
            value={saturation} onValueChange={changeSaturation}/>
          <SettingsAdjustment icon="/ui/settings/contrast-cat.webp" label="对比度" data-settings-contrast=""
            disabled={displayPending}
            min={MIN_CONTRAST} max={MAX_CONTRAST} value={contrast} onValueChange={changeContrast}/>
          <SettingsAdjustment icon="/ui/settings/resolution-cat.webp" label="渲染分辨率"
            disabled={displayPending}
            data-settings-render-scale="" min={0} max={4} step={1} title="调整战斗场景的3D渲染分辨率"
            value={RENDER_RESOLUTION_SCALES.indexOf(display.renderScale)}
            valueText={`${display.renderScale}×`}
            onValueChange={index => changeRenderScale(RENDER_RESOLUTION_SCALES[index])}/>
        </div>
        {([['window', 'rdoWindowMode', '窗口模式'], ['fullscreen', 'rdoFullscreenMode', '全屏模式']] as const)
          .map(([mode, source, label]) => <SettingsChoice key={source} {...props(source)} kind="radio"
            data-settings-display-mode={mode} data-settings-display-binding="web-browser-fullscreen"
            aria-label={label} checked={mode === 'fullscreen' ? fullscreen : !fullscreen}
            aria-busy={displayPending}
            disabled={displayPending || (mode === 'fullscreen' && !document.fullscreenEnabled)}
            onClick={() => {setFullscreen(mode === 'fullscreen'); setStatus('');}}>
            {mode === 'fullscreen' ? '全屏' : '窗口'}
          </SettingsChoice>)}
        <SettingsChoice {...props('chkSilhouette', -74)} kind="checkbox"
          disabled={displayPending}
          data-settings-display-setting="showFps" aria-label="FPS显示" checked={display.showFps}
          onClick={() => changeDisplay({...display, showFps: !display.showFps})}>FPS显示</SettingsChoice>
        <SettingsChoice {...props('chkSilhouette', -49)} kind="checkbox"
          disabled={displayPending}
          data-settings-display-setting="silhouette" aria-label="卡通描边" checked={display.silhouette}
          onClick={() => changeDisplay({...display, silhouette: !display.silhouette})}>卡通描边</SettingsChoice>
        <SettingsChoice {...props('chkSilhouette', -24)} kind="checkbox"
          disabled={displayPending}
          data-settings-display-setting="msaa4x" aria-label="抗锯齿" checked={display.msaa4x}
          title="4× MSAA，点击确定后重新载入客户端"
          onClick={() => setDisplay(value => ({...value, msaa4x: !value.msaa4x}))}>抗锯齿</SettingsChoice>
        <SettingsChoice {...props('chkSilhouette', 1)} kind="checkbox"
          disabled={displayPending}
          data-settings-display-setting="motionBlur" aria-label="动态模糊" checked={display.motionBlur}
          title="移动或转动镜头时产生动态模糊，实时预览，点击确定保存"
          onClick={() => changeDisplay({...display, motionBlur: !display.motionBlur})}>动态模糊</SettingsChoice>
        <div className="settings-battle-artwork" role="group" aria-label="战斗素材画质"
          style={{left: props('rdoFullscreenMode').style.left,
            top: Number(props('rdoFullscreenMode').style.top) + 25}}>
          {([['original', '怀旧画质'], ['hd', 'HD画质']] as const).map(([quality, label]) =>
            <SettingsChoice key={quality} kind="radio" data-settings-battle-artwork={quality}
              disabled={displayPending}
              aria-label={label} checked={artworkQuality === quality}
              onClick={() => {
                setArtworkQuality(quality);
                setStatus(`${label}只切换战斗模型与特效贴图，确认后重新载入客户端。`);
              }}>{label}</SettingsChoice>)}
        </div>
      </>}
      {ui && <GameMessage data-settings-status="" text={status}/>}
      {!ui && <SettingsResourceFeedback error={resourceError} close={close}
        retry={() => {setResourceError(undefined); setResourceAttempt(attempt => attempt + 1);}} />}
    </SourceImageScale>
  </GameDialog>;
}
