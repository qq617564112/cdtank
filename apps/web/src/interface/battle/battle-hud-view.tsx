import {imageResourceUrl} from '../../assets/image-cache';
import {GameMessage} from '../resources/game-message';
import {loadCombatCatalog, preparedCombatCatalog} from '../../content';
import './hud.css';
import {HudItemSourceView} from './hud-item-source-view';
import {HudSpectatorView} from './hud-spectator-view';
import {HudBattleInfoView} from './hud-battle-info-view';
import {HudCountValue, HudTimeValue} from './hud-score-value';
import {BattleMagazine, BattleCrosshair, BattleHealthBar, BattleModeIntro, BattleRemotePortrait, BattleWoodPanel} from './battle-hud-artwork';
import {absoluteRect, sourcePicture} from './hud-source-controls';
import {ImageArtwork} from '../resources/image-artwork';
import {SKILL_STATUS_ARTWORK} from '../../assets/skill-status-artwork';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {useEffect, useState, useSyncExternalStore, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode} from 'react';
import type {BattleHud, HudSnapshot, SourceLayout, SourceUi} from './battle-hud';

export interface HudItemInventoryStore {
  getSnapshot(): {inventory?: ResInventory; selectedWeaponSlot?: number; selectedItemSlot?: number};
  subscribe(listener: () => void): () => void;
}
const DEFAULT_PLAYER_TITLE = '嗷嗷待哺';
const EMPTY_ITEM_INVENTORY: {inventory?: ResInventory; selectedWeaponSlot?: number; selectedItemSlot?: number} = {};
const emptyItemSnapshot = () => EMPTY_ITEM_INVENTORY;
const emptyItemSubscribe = () => () => {};
const MODE_CONTROLS = ['picTeamMode', 'picConquerMode', 'picVIPMode', 'picMeleeMode', 'picDestroyMode'];
const MODE_SCORE_BOUNDS: Record<string, CSSProperties> = {
  picSelfIcon: {left: 12, top: 10, width: 26, height: 26},
  picEnemyIcon: {left: 102, top: 10, width: 26, height: 26},
  lblTimes0: {left: 40, top: 14, width: 12, height: 24},
  lblTimes1: {left: 130, top: 14, width: 12, height: 24},
  txtSelfInfo: {left: 52, top: 14, width: 40, height: 24},
  txtEnemyInfo: {left: 142, top: 14, width: 40, height: 24},
  picIcon: {left: 45, top: 10, width: 26, height: 26},
  txtMultiply: {left: 75, top: 14, width: 12, height: 24},
  txtInfo: {left: 91, top: 14, width: 60, height: 24},
  txtRemainTime: {left: 8, top: 61, width: 174, height: 29},
};

/** Native HTML owns HUD text, live progress and input at the original control bounds. */
export function BattleHudView({hud, items, onUseSlot}: {
  hud: BattleHud; items?: HudItemInventoryStore; onUseSlot: (slot: number) => void;
}) {
  const state = useSyncExternalStore(hud.subscribe, hud.getSnapshot);
  const spectator = useSyncExternalStore(hud.spectator.subscribe, hud.spectator.getSnapshot);
  const [size, setSize] = useState(() => ({width: innerWidth, height: innerHeight}));
  useEffect(() => {
    const resize = () => setSize({width: innerWidth, height: innerHeight});
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const scale = Math.min(size.width / 800, size.height / 600), data = state.data;
  const hudStyle = {
    width: 800, height: 600, left: (size.width - 800 * scale) / 2,
    top: (size.height - 600 * scale) / 2, transform: `scale(${scale})`,
    '--hud-side-offset': `${(size.width / scale - 800) / 2}px`,
  } as CSSProperties;
  return <div id="original-battle-hud" hidden={!state.visible} data-mode={state.mode}
    data-hud-renderer="html" data-spectating={spectator.active || undefined} style={hudStyle}>
    {data && <>
      <HudLayout source={data.layouts.find(layout => layout.path === 'ui/layouts/game_main.xml')!}
        data={data} state={state} hud={hud} scale={scale}/>
      <HudItemPanel data={data} hud={hud} items={items} onUseSlot={onUseSlot}/>
      <HudSpectatorView hud={hud}/>
      {['team', 'conquer', 'vip', 'melee', 'destroy'].map((name, index) => <HudLayout key={name}
        source={data.layouts.find(layout => layout.path === `ui/layouts/game_main_info_${name}.xml`)!}
        data={data} state={state} hud={hud} mode={index + 1} scale={scale}/>)}
      {state.introStage === 'mode' && <BattleModeIntro mode={state.mode}/>}
      {state.introStage === 'fight' && <HudFightIntro data={data}/>}
    </>}
  </div>;
}

function HudFightIntro({data}: {data: SourceUi}) {
  const layout = data.layouts.find(layout => layout.path === 'ui/layouts/game_main.xml')!;
  const control = layout.windows.find(control => control.name === 'picFight')!;
  return <div className="hud-fight-intro" data-source-control="picFight" data-intro-stage="fight"
    role="status" aria-live="polite" aria-label="开战！"
    style={{...absoluteRect(control), ...sourcePicture(data, control.properties.Image)}}/>;
}

function HudItemPanel({data, hud, items, onUseSlot}: {
  data: SourceUi; hud: BattleHud; items?: HudItemInventoryStore; onUseSlot: (slot: number) => void;
}) {
  const combat = useSyncExternalStore(hud.subscribeCombat, hud.getCombatSnapshot);
  const reload = useSyncExternalStore(hud.subscribeReload, hud.getReloadSnapshot);
  const inventory = useSyncExternalStore(items?.subscribe ?? emptyItemSubscribe, items?.getSnapshot ?? emptyItemSnapshot);
  const [catalog, setCatalog] = useState<CombatCatalog | undefined>(preparedCombatCatalog);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void loadCombatCatalog().then(confirmed => {if (active) setCatalog(confirmed);})
      .catch(error => {if (active) setError(String(error));});
    return () => {active = false;};
  }, []);
  return <>
    {catalog && <HudItemSourceView data={data} combat={combat} catalog={catalog}
      inventory={inventory.inventory} selectedWeaponSlot={inventory.selectedWeaponSlot}
      selectedItemSlot={inventory.selectedItemSlot} reloadFraction={reload.fraction} onUseSlot={onUseSlot}/>}
    <GameMessage text={error} tone="error"/>
  </>;
}

function HudLayout({source, data, state, hud, mode, scale}: {
  source: SourceLayout; data: SourceUi; state: HudSnapshot; hud: BattleHud; mode?: number; scale: number;
}) {
  const scoreContext = `${state.roomId}:${state.round ?? 0}:${state.mode}`;
  const scoreActive = state.phase === 'PLAYING' && state.mode === mode;
  const excluded = new Set(mode ? [] : ['daojulan', 'btnExit', 'picMiniMap', 'picMiniMapBound',
    'picFight', 'picModeSplash', ...MODE_CONTROLS]);
  for (const control of source.windows) {
    if (control.parent && excluded.has(control.parent)) excluded.add(control.name);
  }
  const controls = source.windows.filter(control => !excluded.has(control.name)
    && !/^prgPlayerLife\d+$/.test(control.name));
  const names = new Set(controls.map(control => control.name));
  const tree = (parent: string | null): ReactNode => controls.filter(control => parent === null
    ? !control.parent || !names.has(control.parent) : control.parent === parent).map(control => {
    const name = control.name, slot = Number(/\d+$/.exec(name)?.[0]);
    const player = state.slots[slot];
    const anchor = mode && name === 'SheetWindow' ? 'right'
      : /^picPlayer\d+$/.test(name) ? slot < 6 ? 'left' : 'right'
      : name === 'prgBullet' ? 'left' : undefined;
    const props = {'data-source-control': name, 'data-source-layout': source.path, 'data-hud-anchor': anchor};
    const style: CSSProperties = {...absoluteRect(control),
      opacity: control.properties.Alpha ? Number(control.properties.Alpha) : undefined};
    let hidden: boolean | undefined, content: ReactNode, extra: Record<string, unknown> = {};
    let className = 'source-control';
    if (name === 'SheetWindow' && mode) {
      hidden = state.mode !== mode || (state.phase !== 'PLAYING' && state.phase !== 'FINISHED');
      className += ' hud-mode-score';
      Object.assign(style, {left: 602, top: 2, width: 190, height: 100});
      content = <>
        <BattleWoodPanel kind="score" className="hud-score-plaque" data-score-plaque="counts"/>
        <BattleWoodPanel kind="timer" className="hud-score-plaque" data-score-plaque="time"/>
      </>;
    }
    if (/^picPlayer\d+$/.test(name)) {
      hidden = !player;
      extra = {'data-player-id': player?.id, 'data-alive': player ? String(player.alive) : undefined};
    }
    if (/^picPlayerPanel\d+$/.test(name)) {
      className += ' hud-player-panel';
      extra = {'data-player-tone': slot === 0 ? 'local' : slot < 6 ? 'friend' : 'enemy'};
      content = player && player.statuses.length > 0 && <div className="hud-player-statuses"
        role="group" aria-label={`${player.name}状态`}>
        {player.statuses.map(effectId => {
          const status = SKILL_STATUS_ARTWORK.get(effectId)!;
          return <ImageArtwork key={effectId} asset={`/${status.asset}`} fit="contain"
            className="hud-player-status-artwork" data-status-effect={effectId}
            role="img" aria-label={status.label} title={status.label}/>;
        })}
      </div>;
    }
    if (/^picPlayerIconBg\d+$/.test(name)) {
      hidden = slot !== 0;
      content = slot === 0 && <img className="hud-portrait-frame" src={imageResourceUrl('/ui/battle/portrait-local.png')} alt="" aria-hidden="true" draggable={false}/>;
    }
    if (/^picPlayerIcon\d+$/.test(name)) {
      hidden = !player?.asset;
      style.zIndex = 4;
      content = player?.asset && (slot === 0
        ? <ImageArtwork asset={`/${player.asset}`} className="hud-portrait-image"/>
        : <BattleRemotePortrait asset={`/${player.asset}`} enemy={slot >= 6}/>);
      extra = {'data-tank-id': player?.tankId, 'data-pet-id': player?.petId, 'data-expression': player?.expression,
        role: player ? 'img' : undefined, 'aria-label': player ? `${player.name}宠物头像` : undefined};
    }
    if (/^txtPlayerName\d+$/.test(name)) content = player?.name ?? '';
    if (/^txtPlayerTitle\d+$/.test(name)) {
      if (name === 'txtPlayerTitle7') style.left = 11;
      content = player ? player.title || DEFAULT_PLAYER_TITLE : '';
      extra = {'data-source-title-binding': player ? player.title ? 'confirmed-title' : 'default-title-1' : undefined};
    }
    if (/^picVIP\d+$/.test(name)) {hidden = state.mode !== 3 || !player?.isVIP; content = <span className="hud-vip-mark">VIP</span>;}
    if (name === 'edtBattleInfo') {
      content = <HudBattleInfoView ui={data} text={state.messages}/>;
      extra = {onMouseEnter: () => hud.battleInfoHover(true), onMouseLeave: () => hud.battleInfoHover(false)};
      Object.assign(style, {left: 14, top: 10, width: 235, height: 73});
    }
    if (name === 'txtCountdown') {
      const count = state.deathCountdown;
      hidden = count === undefined;
      Object.assign(style, {left: '50%', top: 99, width: 'max-content', height: 28, transform: 'translateX(-50%)'});
      content = count === undefined ? '' : `等待复活中，还剩${count}秒`;
      extra = {'data-value': count, role: 'timer', 'aria-label': content};
    }
    if (name === 'txtRemainTime' && mode) {
      const timer = state.timers[mode - 1];
      extra = {'data-value': timer.text || undefined, role: 'timer', 'aria-label': timer.text || undefined,
        'data-colour': timer.colour};
      content = <HudTimeValue value={timer.text} elapsedMinutes={timer.elapsedMinutes}
        context={scoreContext} active={scoreActive}/>;
    }
    if (mode && mode !== 1 && ['txtSelfInfo', 'txtEnemyInfo', 'txtInfo'].includes(name)) {
      const info = state.modeInfo?.mode === mode ? state.modeInfo : undefined;
      const value = name === 'txtSelfInfo' ? info?.self ?? '' : name === 'txtEnemyInfo' ? info?.enemy ?? '' : info?.info ?? '';
      extra = {'data-mode-info-binding': info?.binding ?? 'unbound', 'data-mode-info-finished': info?.finished ? '' : undefined,
        'data-value': value || undefined, 'aria-label': value || undefined};
      content = value ? `${name === 'txtInfo' ? '' : '× '}${value.padStart(2, '0')}` : '';
    }
    if (mode && (name === 'txtMultiply' || name.startsWith('lblTimes'))) content = '×';
    if (mode === 1 && ['picSelfIcon', 'picEnemyIcon', 'lblTimes0', 'lblTimes1', 'txtSelfInfo', 'txtEnemyInfo'].includes(name)) {
      hidden = !state.teamCounts;
      if (name.startsWith('txt')) {
        const value = name === 'txtSelfInfo' ? state.teamCounts?.self ?? '' : state.teamCounts?.enemy ?? '';
        extra = {'data-value': value || undefined, 'data-team-info-source': 'rebuilt-team-lives',
          'aria-label': `${name === 'txtSelfInfo' ? '本队' : '对队'}存量 ${value || '未知'}`};
        content = <HudCountValue value={value} context={scoreContext} active={scoreActive}/>;
      }
    }
    if (mode && name.startsWith('pic')) {
      const reference = control.properties.Image;
      if (reference?.includes('tanke') || name === 'picSelfIcon' || name === 'picEnemyIcon') {
        const tone = name === 'picEnemyIcon' ? 'red' : 'blue';
        content = <><img className="hud-team-tank" src={imageResourceUrl(`/ui/battle/tank-${tone}.png`)} alt="" draggable={false}/>
          {mode === 3 && <svg className="hud-team-crown" viewBox="0 0 22 12" aria-hidden="true" focusable="false">
            <path d="M2 3L6 6 11 1 16 6 20 3 18 11H4Z" fill="#fff15f" stroke="#644609" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>}</>;
      } else Object.assign(style, sourcePicture(data, reference));
    }
    if (mode) {
      Object.assign(style, MODE_SCORE_BOUNDS[name]);
      if (mode !== 1 && (name === 'txtSelfInfo' || name === 'txtEnemyInfo')) {
        Object.assign(style, {left: name === 'txtSelfInfo' ? 40 : 130, width: 52});
      }
    }
    if (name === 'prgBullet') return <BulletControl key={name} {...props} style={style} hud={hud}/>;
    if (name === 'prgCrossbar') return <ReloadControl key={name} {...props} style={style} hud={hud}/>;
    if (name === 'picBattleInfoPanel') {
      style.left = '50%'; style.transform = 'translateX(-50%)';
      return <BattleInfoPanel key={name} {...props} style={style} hud={hud}>{tree(name)}</BattleInfoPanel>;
    }
    if (control.type.endsWith('/ProgressBar')) {
      const health = name === 'prgLife' ? state.localHealth : player;
      return <BattleHealthBar key={name} {...props} style={style} className="source-control"
        hidden={!health}
        hp={health?.hp ?? 0} maxHp={health?.maxHp ?? 1} name={health?.name ?? ''}
        scale={scale} vertical={control.properties.ProgressFormat === 'Vertical'}
        mirrored={control.properties.BackgroundImage?.includes('xiaoxuecao2.tga')}/>;
    }
    return <div key={name} {...props} {...extra} className={className} style={style} hidden={hidden}>{content}{tree(name)}</div>;
  });
  return <>{tree(null)}</>;
}

function BattleInfoPanel({hud, ...props}: ComponentPropsWithoutRef<'div'> & {hud: BattleHud}) {
  const opacity = useSyncExternalStore(hud.subscribeBattleInfoOpacity, hud.getBattleInfoOpacity);
  return <BattleWoodPanel {...props} kind="information" className="source-control hud-information-panel"
    style={{...props.style, opacity}}/>;
}

function ReloadControl({hud, ...props}: ComponentPropsWithoutRef<'div'> & {hud: BattleHud}) {
  const state = useSyncExternalStore(hud.subscribeReload, hud.getReloadSnapshot);
  return <div {...props} className="source-control hud-reload-control" hidden={!state.visible} role="progressbar"
    aria-label="装填" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.fraction * 100)}>
    <BattleCrosshair fraction={state.fraction}/>
  </div>;
}

function BulletControl({hud, ...props}: ComponentPropsWithoutRef<'div'> & {hud: BattleHud}) {
  const combat = useSyncExternalStore(hud.subscribeCombat, hud.getCombatSnapshot);
  const magazine = combat.magazine;
  return <div {...props} className="source-control hud-bullet-control" hidden={!combat.visible || !magazine}
    style={{...props.style, width: magazine ? magazine.capacity * 15 : 0}}
    role="progressbar" aria-label="弹匣余弹" aria-valuemin={0}
    aria-valuemax={magazine?.capacity} aria-valuenow={magazine?.remaining}
    data-bullet-remaining={magazine?.remaining} data-bullet-capacity={magazine?.capacity}>
    {magazine && <BattleMagazine capacity={magazine.capacity} remaining={magazine.remaining}/>}
  </div>;
}
