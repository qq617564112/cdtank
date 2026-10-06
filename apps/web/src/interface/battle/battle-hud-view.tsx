import './hud.css';
import {HudItemSourceView} from './hud-item-source-view';
import {HudMinimapView} from './hud-minimap-view';
import type {ResInventory} from '../../../../shared/protocols/PtlInventory';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import {lifeProgress} from './life-progress';
import {useEffect, useId, useState, useSyncExternalStore, type CSSProperties} from 'react';
import type {BattleHud, HudPlayer, HudSnapshot, SourceLayout, SourceRegion, SourceUi, SourceWindow} from './battle-hud';

export interface HudItemInventoryStore {
  getSnapshot(): {inventory?: ResInventory};
  subscribe(listener: () => void): () => void;
}
/** Original title table ID 1 is the requested fallback for players without a worn title. */
const DEFAULT_PLAYER_TITLE = '嗷嗷待哺';
const EMPTY_ITEM_INVENTORY: {inventory?: ResInventory} = {};
const emptyItemSnapshot = () => EMPTY_ITEM_INVENTORY;
const emptyItemSubscribe = () => () => {};
export function BattleHudView({hud, items, onUseSlot}: {
  hud: BattleHud; items?: HudItemInventoryStore; onUseSlot: (slot: number) => void;
}) {
  const state = useSyncExternalStore(hud.subscribe, hud.getSnapshot);
  const id = useId(), filterId = `original-timer-red-${id.replace(/:/g, '')}`;
  const [size, setSize] = useState(() => ({width: innerWidth, height: innerHeight}));
  useEffect(() => {
    const resize = () => setSize({width: innerWidth, height: innerHeight});
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  const scale = Math.min(size.width / 800, size.height / 600), data = state.data;
  return <div id="original-battle-hud" hidden={!state.visible} data-mode={state.mode}
    style={{width: 800, height: 600, left: (size.width - 800 * scale) / 2,
      top: (size.height - 600 * scale) / 2, transform: `scale(${scale})`}}>
    <svg width="0" height="0"><filter id={filterId} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
    </filter></svg>
    {data && <>
      <HudLayout source={data.layouts.find(layout => layout.path === 'ui/layouts/game_main.xml')!}
        data={data} state={state} hud={hud} filterId={filterId} scale={scale} intro={state.introStage} />
      <HudItemPanel data={data} hud={hud} items={items} onUseSlot={onUseSlot} />
      <HudMinimapView hud={hud} data={data} />
      {['team', 'conquer', 'vip', 'melee', 'destroy'].map((name, index) => <HudLayout key={name}
        source={data.layouts.find(layout => layout.path === `ui/layouts/game_main_info_${name}.xml`)!}
        data={data} state={state} hud={hud} filterId={filterId} scale={scale} mode={index + 1} />)}
    </>}
  </div>;
}

function HudItemPanel({data, hud, items, onUseSlot}: {
  data: SourceUi; hud: BattleHud; items?: HudItemInventoryStore; onUseSlot: (slot: number) => void;
}) {
  const combat = useSyncExternalStore(hud.subscribeCombat, hud.getCombatSnapshot);
  const inventory = useSyncExternalStore(items?.subscribe ?? emptyItemSubscribe, items?.getSnapshot ?? emptyItemSnapshot);
  const [catalog, setCatalog] = useState<CombatCatalog>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/combat-catalog.json', {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error('道具目录载入失败');
      const confirmed = await response.json() as CombatCatalog;
      if (!controller.signal.aborted) setCatalog(confirmed);
    }).catch(error => {if (!controller.signal.aborted) setError(String(error));});
    return () => controller.abort();
  }, []);
  return <>
    {catalog && <HudItemSourceView data={data} combat={combat} catalog={catalog}
      inventory={inventory.inventory} onUseSlot={onUseSlot} />}
    {error && <output className="hud-resource-error" role="status">{error}</output>}
  </>;
}

function image(data: SourceUi, reference?: string): SourceRegion | undefined {
  const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
  if (!match) return;
  const sets = data.imagesets.filter(set => set.attributes.Name === match[1]);
  const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
  return set?.images.find(region => region.Name === match[2]);
}
function picture(data: SourceUi, reference?: string): CSSProperties {
  const asset = image(data, reference)?.asset;
  return asset ? {backgroundImage: `url('/${asset}')`, backgroundSize: '100% 100%'} : {};
}
function baseStyle(data: SourceUi, control: SourceWindow): CSSProperties {
  const properties = control.properties, rect = properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  return {left: rect[0], top: rect[1], width: rect[2] - rect[0], height: rect[3] - rect[1],
    ...picture(data, properties.Image ?? properties.BackgroundImage),
    textAlign: properties.HorzFormatting === 'HorzCentred' ? 'center' : undefined,
    opacity: properties.Alpha ? Number(properties.Alpha) : undefined};
}
function HudLayout({source, data, state, hud, filterId, scale, mode, intro}: {
  source: SourceLayout; data: SourceUi; state: HudSnapshot; hud: BattleHud;
  filterId: string; scale: number; mode?: number; intro?: 'hidden' | 'mode' | 'fight';
}) {
  const ownedElsewhere = mode ? new Set<string>() : new Set(['daojulan', 'btnExit', 'picMiniMap', 'picMiniMapBound']);
  for (const control of source.windows) {
    if (control.parent && ownedElsewhere.has(control.parent)) ownedElsewhere.add(control.name);
  }
  const controls = source.windows.filter(control => !ownedElsewhere.has(control.name));
  const names = new Set(controls.map(control => control.name));
  const tree = (parent: string | null): React.ReactNode => controls.filter(control => parent === null
    ? !control.parent || !names.has(control.parent) : control.parent === parent).map(control => {
    const name = control.name, props = {'data-source-control': name, 'data-source-layout': source.path};
    const style = baseStyle(data, control), slot = Number(/\d+$/.exec(name)?.[0]), player = state.slots[slot];
    let hidden: boolean | undefined, content: React.ReactNode, extra: Record<string, unknown> = {};
    if (name === 'SheetWindow' && mode) hidden = state.mode !== mode
      || (state.phase !== 'PLAYING' && state.phase !== 'FINISHED');
    if (/^picPlayer\d+$/.test(name)) {hidden = !player; extra = {'data-player-id': player?.id, 'data-alive': player ? String(player.alive) : undefined};}
    const flipImage = control.properties.Orientation === 'FlipHorizontal';
    const iconStyle: CSSProperties = {};
    if (/^picPlayerIcon\d+$/.test(name)) {
      hidden = !player?.asset;
      iconStyle.backgroundImage = player?.asset ? `url('/${player.asset}')` : 'none';
      iconStyle.backgroundSize = '100% 100%';
      extra = {'data-tank-id': player ? String(player.tankId) : undefined, 'data-pet-id': player?.petId === undefined ? undefined : String(player.petId), 'data-expression': player?.expression,
        role: player ? 'img' : undefined, 'aria-label': player ? `${player.name}宠物头像` : undefined};
    }
    if (/^txtPlayerName\d+$/.test(name)) content = player?.name ?? '';
    if (/^txtPlayerTitle\d+$/.test(name) && mode === undefined) {
      content = player ? player.title || DEFAULT_PLAYER_TITLE : '';
      extra = {'data-source-title-binding': player ? player.title ? 'confirmed-title' : 'default-title-1' : undefined};
    }
    if (/^picVIP\d+$/.test(name) && mode === undefined) hidden = state.mode !== 3 || !player?.isVIP;
    if (name === 'edtBattleInfo') {
      content = state.messages;
      extra = {onMouseEnter: () => hud.battleInfoHover(true), onMouseLeave: () => hud.battleInfoHover(false)};
    }
    if (name === 'txtCountdown') {
      const count = state.deathCountdown;
      hidden = count === undefined;
      style.display = hidden ? 'none' : 'flex';
      style.justifyContent = 'center'; style.alignItems = 'center'; style.color = '#fff';
      const value = count === undefined ? '' : String(count);
      extra = {'data-value': value || undefined, 'data-source-font': 'Countdown',
        'data-colour': 'ffffffff', 'aria-label': value ? `复活倒计时 ${value}` : undefined};
      content = <HudText data={data} value={value} fontName="Countdown"/>;
    }
    if (name === 'txtRemainTime' && mode) {
      const timer = state.timers[mode - 1];
      extra = {'data-value': timer.text || undefined, 'aria-label': timer.text || undefined, 'data-colour': timer.colour};
      style.filter = timer.colour === 'ffff0000' ? `url(#${filterId})` : 'none';
      content = <HudText data={data} value={timer.text} />;
    }
    if (mode && mode !== 1 && ['txtSelfInfo', 'txtEnemyInfo', 'txtInfo'].includes(name)) {
      const info = state.modeInfo?.mode === mode ? state.modeInfo : undefined;
      const value = name === 'txtSelfInfo' ? info?.self ?? '' : name === 'txtEnemyInfo' ? info?.enemy ?? '' : info?.info ?? '';
      extra = {'data-mode-info-binding': info?.binding ?? 'unbound', 'data-mode-info-finished': info?.finished ? '' : undefined,
        'data-value': value || undefined, 'aria-label': value || undefined};
      content = <HudText data={data} value={value} />;
    }
    if (mode && name === 'txtMultiply') {
      const value = control.properties.Text ?? '';
      extra = {'data-value': value, 'aria-label': value};
      content = <HudText data={data} value={value} />;
    }
    if (mode === 1 && ['picSelfIcon', 'picEnemyIcon', 'lblTimes0', 'lblTimes1', 'txtSelfInfo', 'txtEnemyInfo'].includes(name)) {
      hidden = !state.teamCounts;
      if (name.startsWith('lblTimes')) {extra = {'data-value': '*', 'aria-label': '*'}; content = <HudText data={data} value="*" />;}
      if (name.startsWith('txt')) {
        const value = name === 'txtSelfInfo' ? state.teamCounts?.self ?? '' : state.teamCounts?.enemy ?? '';
        extra = {'data-value': value || undefined, 'data-team-info-source': state.visible ? 'rebuilt-team-lives' : undefined,
          'aria-label': state.visible ? `${name === 'txtSelfInfo' ? '本队' : '对队'}存量 ${value || '未知'}` : undefined};
        content = <HudText data={data} value={value} />;
      }
    }
    if (mode === undefined && (name === 'picFight' || name === 'picModeSplash'
        || name === 'picTeamMode' || name === 'picConquerMode' || name === 'picVIPMode'
        || name === 'picMeleeMode' || name === 'picDestroyMode')) {
      const splashMode = name === 'picTeamMode' ? 1 : name === 'picConquerMode' ? 2 : name === 'picVIPMode' ? 3
        : name === 'picMeleeMode' ? 4 : name === 'picDestroyMode' ? 5 : undefined;
      hidden = name === 'picFight' ? intro !== 'fight'
        : intro !== 'mode' || (splashMode !== undefined && splashMode !== state.mode);
    }
    if (name === 'prgBullet') return <BulletControl key={name} {...props} style={style} control={control} data={data} hud={hud} scale={scale} />;
    if (name === 'prgCrossbar') return <ReloadControl key={name} {...props} style={style} control={control} data={data} hud={hud} scale={scale} />;
    if (name === 'picBattleInfoPanel') return <BattleInfoPanel key={name} {...props} style={style} hud={hud}>{tree(name)}</BattleInfoPanel>;
    if (control.type.endsWith('/ProgressBar')) return <HealthControl key={name} {...props} style={style} control={control} data={data}
      player={name === 'prgLife' ? state.localHealth : player} scale={scale} />;
    if (flipImage && !/^picPlayerIcon\d+$/.test(name)) {
      const background = picture(data, control.properties.Image ?? control.properties.BackgroundImage);
      return <div key={name} {...props} {...extra} className="source-control" style={{...style, backgroundImage: 'none'}} hidden={hidden}>
        <div className="source-control-image" style={{...background, transform: 'scaleX(-1)'}} />
        {content}{tree(name)}
      </div>;
    }
    if (flipImage) iconStyle.transform = 'scaleX(-1)';
    return <div key={name} {...props} {...extra} className="source-control" style={{...style, ...iconStyle}} hidden={hidden}>{content}{tree(name)}</div>;
  });
  return <>{tree(null)}</>;
}

function BattleInfoPanel({hud, style, children, ...props}: {
  hud: BattleHud; style: CSSProperties; children: React.ReactNode;
}) {
  const opacity = useSyncExternalStore(hud.subscribeBattleInfoOpacity, hud.getBattleInfoOpacity);
  return <div {...props} className="source-control" style={{...style, opacity}}>{children}</div>;
}

function HudText({value, fontName = 'BigHT'}: {data: SourceUi; value: string; fontName?: string}) {
  const size = fontName === 'Countdown' ? 70 : 20;
  return <span data-dynamic-font="xiangjiao-brush" style={{fontSize: size,
    lineHeight: `${size}px`, color: '#fff', whiteSpace: 'nowrap'}}>{value}</span>;
}

function HealthControl({control, data, player, scale, style, ...props}: {
  control: SourceWindow; data: SourceUi; player?: Pick<HudPlayer, 'name' | 'hp' | 'maxHp'>; scale: number; style: CSSProperties;
}) {
  return <SourceProgress {...props} control={control} data={data} style={style} scale={scale}
    hidden={!player}
    fraction={lifeProgress(player?.hp ?? 1, player?.maxHp ?? 1, 1).fraction} className="source-life-progress"
    aria-label={player ? `${player.name}生命` : '生命'} aria-valuemin={player ? 0 : undefined}
    aria-valuemax={player?.maxHp} aria-valuenow={player?.hp} title={player ? `${player.hp}/${player.maxHp}` : undefined} />;
}

function SourceProgress({control, data, fraction, scale, style, className, ...props}: {
  control: SourceWindow; data: SourceUi; fraction: number; scale: number; style: CSSProperties;
} & React.ComponentProps<'div'>) {
  const id = useId(), filterId = `original-life-colour-${id.replace(/:/g, '')}`;
  const properties = control.properties, vertical = properties.ProgressFormat === 'Vertical';
  const width = Number(style.width), height = Number(style.height);
  const projection = lifeProgress(fraction, 1, Math.fround((vertical ? height : width) * scale));
  const colour = properties[['ProgressLowBoundColour', 'ProgressMediumColour', 'ProgressHighBoundColour'][projection.band]] ?? 'FFFFFFFF';
  const rgb = [2, 4, 6].map(offset => parseInt(colour.slice(offset, offset + 2), 16) / 255);
  const clip = vertical ? `inset(${height - projection.extent / scale}px 0 0 0)`
    : `inset(0 ${width - projection.extent / scale}px 0 0)`;
  function tile(reference: string | undefined): CSSProperties {
    const match = /^set:(\S+) image:(.+)$/.exec(reference ?? '');
    const sets = data.imagesets.filter(set => set.attributes.Name === match?.[1]);
    const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
    const region = set?.images.find(region => region.Name === match?.[2]);
    if (!region?.asset) return {};
    const dimension = (axis: 'Width' | 'Height') => {
      const native = Number(set.attributes[axis === 'Width' ? 'NativeHorzRes' : 'NativeVertRes'] ?? (axis === 'Width' ? 800 : 600));
      const factor = set.attributes.AutoScaled === 'true' ? (axis === 'Width' ? 800 : 600) * scale / native : 1;
      return Math.round(Math.fround(Number(region[axis]) * Math.fround(factor)));
    };
    const tileWidth = dimension('Width'), tileHeight = dimension('Height');
    const columns = Math.trunc((width * scale + tileWidth - 1) / tileWidth);
    const rows = Math.trunc((height * scale + tileHeight - 1) / tileHeight);
    return {width: columns * tileWidth / scale, height: rows * tileHeight / scale,
      backgroundImage: `url('/${region.asset}')`, backgroundSize: `${tileWidth / scale}px ${tileHeight / scale}px`, backgroundRepeat: 'repeat'};
  }
  return <div {...props} className={`source-control source-progress-control ${className ?? ''}`} style={{...style, backgroundImage: 'none'}}
    data-progress-format={vertical ? 'Vertical' : 'Horizontal'} data-source-progress-fraction={projection.fraction}
    data-source-progress-extent={projection.extent} data-source-progress-colour={colour}
    role="progressbar">
    <svg width="0" height="0"><filter id={filterId} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={`${rgb[0]} 0 0 0 0  0 ${rgb[1]} 0 0 0  0 0 ${rgb[2]} 0 0  0 0 0 1 0`} />
    </filter></svg>
    <div className="source-life-background source-progress-background" style={tile(properties.BackgroundImage)} />
    <div className="source-progress-fill" style={{clipPath: clip}}>
      <div className="source-life-image source-progress-image" style={{...tile(properties.ProgressImage), filter: `url(#${filterId})`}} />
    </div>
  </div>;
}

function ReloadControl({hud, control, data, scale, style, ...props}: {
  hud: BattleHud; control: SourceWindow; data: SourceUi; scale: number; style: CSSProperties;
}) {
  const state = useSyncExternalStore(hud.subscribeReload, hud.getReloadSnapshot);
  return <SourceProgress {...props} control={control} data={data} style={style} scale={scale} fraction={state.fraction}
    hidden={!state.visible} aria-label="装填" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={Math.round(state.fraction * 100)} aria-valuetext={state.fraction < 1 ? '装填中' : '装填完成'} />;
}

/** Original4cb52f: width = capacity × 15, progress = remaining / capacity. */
function BulletControl({control, data, hud, scale, style, ...props}: {
  control: SourceWindow; data: SourceUi; hud: BattleHud; scale: number; style: CSSProperties;
}) {
  const combat = useSyncExternalStore(hud.subscribeCombat, hud.getCombatSnapshot);
  const capacity = combat.magazine?.capacity, remaining = combat.magazine?.remaining;
  const valid = combat.visible && capacity !== undefined && capacity > 0 && remaining !== undefined;
  const width = valid ? Math.fround(capacity * 15) : 0;
  const fraction = valid ? Math.fround(Math.max(0, Math.min(1, remaining / capacity))) : 0;
  return <SourceProgress {...props} control={control} data={data} className="hud-bullet-control"
    data-source-asset={image(data, control.properties.BackgroundImage)?.asset}
    data-bullet-remaining={remaining} data-bullet-capacity={capacity}
    data-bullet-source={valid ? 'combat-snapshot' : undefined} style={{...style, width}} scale={scale}
    fraction={fraction} hidden={!valid} aria-label="弹匣余弹" aria-valuemin={0} aria-valuemax={capacity}
    aria-valuenow={remaining} aria-valuetext={valid ? `${remaining}/${capacity}` : undefined}
    title={valid ? `${remaining}/${capacity}` : undefined} />;
}
