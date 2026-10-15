import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties} from 'react';
import type {Battle} from '../../match/battle';
import type {HudSnapshot, SourceUi} from './battle-hud';
import {ImageArtwork} from '../resources/image-artwork';
import {BattleCrosshair, BattleModeIntro} from './battle-hud-artwork';
import {MobileBattleJoystick, MobileBattleFire} from './mobile-battle-controls';
import {MobileBattleItems} from './mobile-battle-items';
import {MobileBattlePortrait} from './mobile-battle-portrait';
import {HudSpectatorView} from './hud-spectator-view';
import {parseChatSourceMarkup} from './chat-source-markup';
import {sourceAsset} from './hud-source-controls';
import {SKILL_STATUS_ARTWORK} from '../../assets/skill-status-artwork';
import './mobile-battle-hud.css';

export function MobileBattleHud({battle, scoreboardOpen, onScoreboard}: {
  battle: Battle; scoreboardOpen: boolean; onScoreboard: () => void;
}) {
  const hud = battle.originalHud;
  const state = useSyncExternalStore(hud.subscribe, hud.getSnapshot);
  const combat = useSyncExternalStore(hud.subscribeCombat, hud.getCombatSnapshot);
  const reload = useSyncExternalStore(hud.subscribeReload, hud.getReloadSnapshot);
  const chat = useSyncExternalStore(battle.chat.subscribe, battle.chat.getSnapshot);
  const match = useSyncExternalStore(battle.matchPanel.subscribe, battle.matchPanel.getSnapshot);
  const root = useRef<HTMLDivElement>(null), minimap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [modal, setModal] = useState(false);
  const visible = state.visible && match?.loading.progress === 1;
  const disabled = !visible || !combat.canUseShortcuts || scoreboardOpen || chat.editing || modal;
  useLayoutEffect(() => {
    if (!visible) return;
    const resize = () => {
      const {clientWidth: width, clientHeight: height} = root.current!;
      const portrait = width < height;
      setScale(Math.min(width / (portrait ? 440 : 960), height / (portrait ? 780 : 440)));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root.current!); resize();
    return () => observer.disconnect();
  }, [visible]);
  useLayoutEffect(() => {
    if (!visible) return;
    const resize = () => {
      const bounds = minimap.current!.getBoundingClientRect();
      battle.setMobileMinimapBounds({left: bounds.left, top: bounds.top, size: bounds.width});
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root.current!); observer.observe(minimap.current!);
    window.addEventListener('resize', resize); resize();
    return () => {
      observer.disconnect(); window.removeEventListener('resize', resize);
      battle.setMobileMinimapBounds(undefined);
    };
  }, [battle, scale, visible]);
  useEffect(() => {
    if (!visible) return;
    const update = () => setModal(Boolean(document.querySelector('dialog[open]')));
    const observer = new MutationObserver(update);
    observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['open']});
    update();
    document.body.classList.add('mobile-battle-active');
    return () => {observer.disconnect(); document.body.classList.remove('mobile-battle-active');};
  }, [visible]);
  useEffect(() => {
    if (disabled) battle.clearTouchInput();
    return () => battle.clearTouchInput();
  }, [battle, disabled, state.roomId, state.round]);
  const player = state.slots.find(player => player?.id === combat.playerId);
  const health = state.localHealth;
  const fraction = health ? Math.max(0, Math.min(1, health.hp / health.maxHp)) : 0;
  const magazine = combat.magazine;
  return <div ref={root} id="mobile-battle-hud" hidden={!visible} data-mode={state.mode}
    data-hud-renderer="mobile" style={{'--mobile-scale': scale} as CSSProperties}>
    {(['movement', 'turret'] as const).map(kind => <MobileBattleJoystick
      key={`${state.roomId}:${state.round}:${kind}`} kind={kind} disabled={disabled}
      scale={scale} onInput={battle.setTouchInput}/>)}
    <div className="mobile-battle-player mobile-battle-sized">
      <div className="mobile-battle-portrait" role="img" aria-label={`${health?.name ?? ''}宠物头像`}>
        <div className="mobile-battle-portrait-image">
          {player?.asset && <MobileBattlePortrait asset={`/${player.asset}`}/>}
        </div>
        <ImageArtwork className="mobile-battle-portrait-frame" asset="/ui/battle/mobile/portrait-frame.webp"/>
      </div>
      <div className="mobile-battle-health" role="progressbar" aria-label={`${health?.name ?? ''}生命`}
        aria-valuemin={0} aria-valuemax={health?.maxHp ?? 1} aria-valuenow={health?.hp ?? 0}
        data-health-band={fraction < .3 ? 'low' : fraction < .6 ? 'medium' : 'full'}>
        <span className="mobile-battle-health-fill" style={{width: `${fraction * 100}%`}}/>
        <span className="mobile-battle-health-value">{health ? `${Math.ceil(health.hp)}/${Math.ceil(health.maxHp)}` : ''}</span>
      </div>
      {magazine && <div className="mobile-battle-magazine" aria-label={`弹匣 ${magazine.remaining}/${magazine.capacity}`}>
        <div className="mobile-battle-shells" aria-hidden="true">
          {Array.from({length: magazine.capacity}, (_, index) => <i key={index} data-filled={index < magazine.remaining || undefined}/>)}
        </div>
        <span data-bullet-remaining={magazine.remaining} data-bullet-capacity={magazine.capacity}>
          {magazine.remaining}/{magazine.capacity}
        </span>
      </div>}
      <div className="mobile-battle-statuses" aria-label="战斗状态">
        {player?.statuses.map(effectId => {
          const status = SKILL_STATUS_ARTWORK.get(effectId)!;
          return <ImageArtwork key={effectId} asset={`/${status.asset}`} fit="contain"
            role="img" aria-label={status.label} data-status-effect={effectId}/>;
        })}
      </div>
    </div>
    <MobileBattleScore state={state}/>
    <div ref={minimap} className="mobile-battle-minimap mobile-battle-sized" aria-label="实时小地图"/>
    <button type="button" className="mobile-battle-scoreboard mobile-battle-art-button mobile-battle-sized"
      data-battle-button-sound=""
      aria-label="打开计分板" aria-expanded={scoreboardOpen} onClick={onScoreboard}>
      <ImageArtwork asset="/ui/battle/mobile/scoreboard-normal.webp"/>
    </button>
    <button type="button" className="mobile-battle-chat-button mobile-battle-art-button mobile-battle-sized"
      data-battle-button-sound=""
      aria-label="打开聊天" disabled={scoreboardOpen || modal} onClick={() => {
        battle.clearTouchInput(); battle.chat.releaseInputKeys(); battle.chat.openEditor();
      }}><ImageArtwork asset="/ui/battle/mobile/chat-normal.webp"/></button>
    <div className="mobile-battle-controls mobile-battle-sized">
      <MobileBattleFire disabled={disabled} onInput={battle.setTouchInput}/>
      {state.data && <MobileBattleItems hud={hud} data={state.data} items={battle.itemInventory}
        disabled={disabled} onUseSlot={battle.useHudSlot}/>}
    </div>
    <div className="mobile-battle-crosshair mobile-battle-sized" aria-label={reload.visible ? '装填中' : '准星'}>
      <BattleCrosshair fraction={reload.visible ? reload.fraction : 1}/>
    </div>
    {state.data && state.notice && <MobileBattleNotice key={state.notice.id} ui={state.data} text={state.notice.text}/>}
    {state.deathCountdown !== undefined && <p className="mobile-battle-respawn mobile-battle-sized" role="timer">
      等待复活 · {state.deathCountdown}秒
    </p>}
    <div className="mobile-battle-spectator mobile-battle-sized"><HudSpectatorView hud={hud}/></div>
    {state.introStage === 'mode' && <div className="mobile-battle-intro"><BattleModeIntro mode={state.mode}/></div>}
    {state.introStage === 'fight' && <p className="mobile-battle-fight" role="status">开战！</p>}
  </div>;
}

function MobileBattleScore({state}: {state: HudSnapshot}) {
  const info = state.modeInfo;
  const individual = state.mode > 3;
  const timer = state.timers[state.mode - 1];
  return <div className="mobile-battle-score mobile-battle-sized" aria-label={info?.label ?? '战斗比分'}>
    <ImageArtwork className="mobile-battle-score-plank" asset="/ui/battle/mobile/score-timer-board.webp"/>
    <div className="mobile-battle-score-line" data-individual={individual || undefined}>
      {!individual && <MobileBattleTeamScore side="self" value={info?.self ?? state.teamCounts?.self}/>}
      <span className="mobile-battle-timer" role="timer" aria-label={timer?.text}
        data-urgency={timer?.colour === 'ffff0000' ? 'critical' : undefined}>{timer?.text}</span>
      {individual ? <span className="mobile-battle-individual-score" aria-label={`${info?.label ?? '数量'} ${info?.info ?? '未知'}`}>
        {info?.label} × {info?.info ?? '—'}
      </span> : <MobileBattleTeamScore side="enemy" value={info?.enemy ?? state.teamCounts?.enemy}/>}
    </div>
  </div>;
}

function MobileBattleTeamScore({side, value}: {side: 'self' | 'enemy'; value?: string}) {
  const text = value?.padStart(2, '0') ?? '—';
  return <span className="mobile-battle-team-score" data-side={side}
    aria-label={`${side === 'self' ? '我方' : '敌方'} ${value ?? '未知'}`}>
    <ImageArtwork asset={`/ui/battle/tank-${side === 'self' ? 'blue' : 'red'}.png`}/>
    <strong style={{fontSize: text.length > 3 ? 90 / text.length : undefined}}>{text}</strong>
  </span>;
}

function MobileBattleNotice({ui, text}: {ui: SourceUi; text: string}) {
  const parsed = parseChatSourceMarkup(text, (set, name) => Boolean(sourceAsset(ui, `set:${set} image:${name}`)));
  return <div className="mobile-battle-notice mobile-battle-sized" role="status" aria-live="polite">
    {parsed.status === 'parse-error' ? text : parsed.items.map((item, index) => {
      const asset = item.image ? sourceAsset(ui, `set:${item.image.set} image:${item.image.name}`)
        : item.emoteId ? sourceAsset(ui, `set:biaoqingfuhao0 image:data\\ui\\biaoqingfuhao\\${String(item.emoteId).padStart(3, '0')}.tga`) : undefined;
      const [r, g, b, a] = item.colour;
      const colour = r === 1 && g === 0 && b === 0 ? '#ffaaa0' : r === 0 && g === 0 && b === 1 ? '#8be6ff'
        : `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      return asset ? <ImageArtwork key={index} asset={`/${asset}`} fit="contain" aria-label={item.text}/>
        : <span key={index} style={{color: colour}}>{item.text.replace(/\r?\n/g, ' ')}</span>;
    })}
  </div>;
}
