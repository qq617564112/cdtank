import {memo, useId, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode, type Ref} from 'react';
import {useButtonInteraction} from '../resources/button-interaction';
import {GameSurfaceTexture} from '../resources/game-surface-texture';
import {ImageArtwork, SvgImageArtwork} from '../resources/image-artwork';
import {imageResourceUrl} from '../../assets/image-cache';
import {BATTLE_WOOD_PANEL_ARTWORK} from '../../assets/battle-hud-images';
import {lifeProgress} from './life-progress';
import {BATTLE_REMOTE_PORTRAITS} from './battle-portrait-bounds';

/** Character and frame share one bitmap; expression overflow does not affect placement. */
export const BattleRemotePortrait = memo(function BattleRemotePortrait({asset, enemy}: {asset: string; enemy: boolean}) {
  const placement = BATTLE_REMOTE_PORTRAITS[enemy ? 'enemy' : 'friend'];
  return <svg className="hud-portrait-image" viewBox="0 0 65 53" preserveAspectRatio="none"
    overflow="visible" aria-hidden="true" focusable="false" data-source-asset={asset.replace(/^\//, '')}>
    <SvgImageArtwork asset={asset} {...placement} preserveAspectRatio="none"/>
  </svg>;
});

const MODE_INTROS = [
  {label: '团队模式', instruction: '将敌队的坦克通通消灭！', left: 206, width: 381},
  {label: '占领模式', instruction: '看谁先破坏对方碉堡！', left: 225, width: 344},
  {label: '擒王模式', instruction: '看谁先击毁对方VIP！', left: 225, width: 344},
  {label: '混战模式', instruction: '只要是会动的都是敌人！', left: 206, width: 381},
  {label: '破坏模式', instruction: '尽情破坏一切东西！', left: 245, width: 309},
];

/** Mode announcements keep the source burst and caption bounds. */
export function BattleModeIntro({mode}: {mode: number}) {
  const intro = MODE_INTROS[mode - 1]!;
  return <div className="hud-mode-intro" data-intro-stage="mode" role="status" aria-live="polite">
    <img className="hud-mode-explosion" src={imageResourceUrl('/ui/battle/mode-explosion.svg')}
      data-source-control="picModeSplash" alt="" aria-hidden="true" draggable={false}/>
    <span className="hud-mode-label">{intro.label}</span>
    <span className="hud-mode-instruction" style={{width: intro.width, left: intro.left}}>
      {intro.instruction}
    </span>
  </div>;
}

/** Decorative wood is separate from live HTML content. */
export function BattleWoodPanel({kind, children, className = '', ...props}:
  ComponentPropsWithoutRef<'div'> & {kind: 'information' | 'spectator' | 'score' | 'timer'}) {
  return <div {...props} className={`battle-wood-panel ${className}`} data-wood-panel={kind}>
    {kind === 'information' ? <BattleInformationPanelArtwork/>
      : <img src={imageResourceUrl(BATTLE_WOOD_PANEL_ARTWORK[kind])}
        alt="" aria-hidden="true" draggable={false}/>}
    {children}
  </div>;
}

/** The information panel shares the MDF grain and recessed olive frame of lobby cards. */
const BattleInformationPanelArtwork = memo(function BattleInformationPanelArtwork() {
  const id = useId();
  const face = 'M6 5L257 5.3L256.7 88L6.3 87.7Z';
  return <svg className="battle-information-artwork" viewBox="0 0 263 93" preserveAspectRatio="none"
    aria-hidden="true" focusable="false">
    <GameSurfaceTexture id={`${id}-paper`} tone="player-paper" size={{width: 263, height: 93}}/>
    <GameSurfaceTexture id={`${id}-rim`} tone="panel-gold" size={{width: 263, height: 93}}/>
    <defs>
      <filter id={`${id}-paper-color`} colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="linear" slope=".85"/>
          <feFuncG type="linear" slope=".88"/>
          <feFuncB type="linear" slope=".92"/>
        </feComponentTransfer>
      </filter>
      <filter id={`${id}-inset`} x="-10%" y="-20%" width="120%" height="140%"
        colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="soft-contour"/>
        <feOffset in="soft-contour" dx=".6" dy="3" result="lower-contour"/>
        <feComposite in="SourceAlpha" in2="lower-contour" operator="out" result="inner-edge"/>
        <feFlood floodColor="#3e351a" floodOpacity=".72"/>
        <feComposite in2="inner-edge" operator="in"/>
      </filter>
    </defs>
    <path d="M1.5 1.4L83 1 169 1.6 261.4 1.2 261 32 262 61 261.3 91.5
      L180 91.8 89 91.3 1.6 92 1 62 1.8 31Z" fill={`url(#${id}-rim)`}
      stroke="#797044" strokeWidth=".8" strokeLinejoin="round"/>
    <path d={face} fill={`url(#${id}-paper)`} filter={`url(#${id}-paper-color)`}/>
    <path d={face} fill="#000" filter={`url(#${id}-inset)`}/>
    <path d="M6.3 87.7L256.7 88L257 5.3" fill="none" stroke="#e1d6af"
      strokeOpacity=".35" strokeWidth=".6"/>
  </svg>;
});

export function BattleHealthBar({hp, maxHp, name, vertical = false, mirrored = false, scale,
  className = '', ...props}: ComponentPropsWithoutRef<'div'> & {
  hp: number; maxHp: number; name: string; vertical?: boolean; mirrored?: boolean; scale: number;
}) {
  const width = Number(props.style?.width), height = Number(props.style?.height);
  const progress = lifeProgress(hp, maxHp, Math.fround((vertical ? height : width) * scale));
  const clipPath = vertical ? `inset(${height - progress.extent / scale}px 0 0 0)`
    : `inset(0 ${width - progress.extent / scale}px 0 0)`;
  return <div {...props} className={`battle-health-bar ${className}`}
    data-health-band={progress.band} data-health-vertical={vertical || undefined}
    data-health-mirrored={mirrored || undefined} data-source-progress-fraction={progress.fraction}
    data-source-progress-extent={progress.extent} role="progressbar" aria-label={`${name}生命`}
    aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp} title={`${hp}/${maxHp}`}>
    {vertical ? <AvatarHealthArc/> : <span className="battle-health-track" aria-hidden="true"/>}
    <span className="battle-health-fill" style={{clipPath}} aria-hidden="true">
      {vertical ? <AvatarHealthArc/> : <span className="battle-health-ink"/>}
    </span>
  </div>;
}

function AvatarHealthArc() {
  return <svg className="battle-health-arc" viewBox="0 0 14 38" aria-hidden="true" focusable="false">
    <path d="M2 1.2A21 20.5 0 0 1 2 36.8"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>;
}

/** The eight shortcut sockets retain individual uneven corners at any UI scale. */
export function BattleItemSocket({selected}: {selected: boolean}) {
  return <svg className="battle-item-socket" viewBox="0 0 34 34" preserveAspectRatio="none"
    aria-hidden="true" focusable="false" data-selected={selected || undefined}>
    <path d="M1.5 2L31.7 1.4 32.5 31.8 1.4 32.3Z" fill="#264c34" fillOpacity=".8"
      stroke="#0f251a" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M3.5 29.6L3 3.7 29.8 3.2" fill="none" stroke="#d4f4ae" strokeWidth="1.2"/>
    <path d="M4.1 30.6L30.4 30 30.1 4" fill="none" stroke="#4e9460" strokeWidth="1.4"/>
    {selected && <path d="M1.8 2.2L31.5 1.8 32 31.4 2 31.8Z" fill="none"
      stroke="#fff15d" strokeWidth="2.5" strokeLinejoin="round"/>}
  </svg>;
}

/** Source magazine strips retain the original twelve 15px bullet tiles. */
export function BattleMagazine({capacity, remaining}: {capacity: number; remaining: number}) {
  const emptyWidth = (capacity - remaining) * 15;
  return <>
    <ImageArtwork asset="/ui/regions/77/18.png" repeat={{width: 180, height: 35}}
      className="battle-magazine-layer"/>
    <ImageArtwork asset="/ui/regions/77/17.png" repeat={{width: 180, height: 35}}
      className="battle-magazine-layer" style={{clipPath: `inset(0 ${emptyWidth}px 0 0)`}}/>
  </>;
}

/** Original 50×37 slanted brackets and center mark reveal upwards while reloading. */
export function BattleCrosshair({fraction, clipRef}: {fraction: number; clipRef?: Ref<SVGRectElement>}) {
  const id = useId();
  const bracket = 'M14.354 5.5H19.615L9.678 32.5H4.377Z';
  const fill = 'M13.562 6H19.951L10.521 32H4.14Z';
  return <svg className="battle-crosshair" viewBox="0 0 50 37" preserveAspectRatio="none"
    aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={id}>
        <rect ref={clipRef} x="0" y={37 * (1 - fraction)} width="50" height={37 * fraction}/>
      </clipPath>
    </defs>
    <g fill="none" stroke="#545554" strokeWidth="1.3" strokeLinejoin="miter">
      <path d={bracket}/>
      <path d={bracket} transform="translate(51 0) scale(-1 1)"/>
      <rect x="24.5" y="2.5" width="2" height="6" strokeWidth="1"/>
    </g>
    <g fill="#ff0" clipPath={`url(#${id})`}>
      <path d={fill}/>
      <path d={fill} transform="translate(51 0) scale(-1 1)"/>
      <rect x="25" y="3" width="1" height="5"/>
    </g>
  </svg>;
}

export function BattleArrowButton({direction, children, ...props}: ComponentPropsWithoutRef<'button'> & {
  direction: 'left' | 'right'; children?: ReactNode;
}) {
  const {element, buttonProps, state} = useButtonInteraction(props);
  return <button {...buttonProps} ref={element} className={`battle-arrow-button ${props.className ?? ''}`}
    data-direction={direction} data-source-button-state={state}>
    <svg viewBox="0 0 28 37" aria-hidden="true" focusable="false">
      <g transform={direction === 'right' ? 'translate(28 0) scale(-1 1)' : undefined}>
        <path d="M24 3Q25 1 25.5 5L25 32Q25 36 22 33L3 20Q1 18.5 3 17Z"
          fill="var(--battle-arrow-face, #88e7dc)" stroke="#273b31" strokeWidth="2.5" strokeLinejoin="round"/>
        <path d="M21 6L5.5 18.5 8 19.5 21 10Z" fill="#e5fff0"/>
        <path d="M22 10L22 30 7 20 10 19Z" fill="#3caaa1" fillOpacity=".6"/>
      </g>
    </svg>
    {children}
  </button>;
}
