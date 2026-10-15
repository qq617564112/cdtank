import {imageResourceUrl} from '../../assets/image-cache';
import {useId, type ComponentPropsWithoutRef} from 'react';
import {useButtonInteraction} from './button-interaction';
import {GameSurfaceTexture} from './game-surface-texture';
import './game-mode-tab.css';

export type GameMode = 1 | 2 | 3 | 4 | 5 | 6;

const MODE_LABELS: Record<GameMode, string> = {
  1: '团队模式', 2: '占领模式', 3: '擒王模式', 4: '混战模式', 5: '破坏模式', 6: '训练模式',
};
const MODE_ICONS: Record<GameMode, string> = {
  1: 'team', 2: 'conquer', 3: 'vip', 4: 'melee', 5: 'destroy', 6: 'training',
};

interface GameModeTabProps extends ComponentPropsWithoutRef<'button'> {
  mode: GameMode;
  selected: boolean;
}

/** The active canvas tab joins the dialog; other modes retain their illustrated green pill. */
export function GameModeTab({mode, selected, className = '', ...props}: GameModeTabProps) {
  const {element, buttonProps, state} = useButtonInteraction(props);
  const id = useId();
  const textureId = `${id}-texture`;
  const faceId = `${id}-face`;
  const active = selected || state === 'Pushed';
  const artwork = '/ui/map-selector/mode-tabs.svg';
  const shape = mode === 6 ? 4 : mode;
  return <button {...buttonProps} ref={element} className={`game-mode-tab ${className}`}
    aria-label={props['aria-label'] ?? MODE_LABELS[mode]} aria-pressed={selected}
    data-game-mode={mode} data-mode-tab-active={active} data-source-button-state={state}>
    <svg viewBox="0 0 115 50" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {active ? <>
        <GameSurfaceTexture id={textureId} tone="room-canvas"/>
        <use href={imageResourceUrl(`${artwork}#selected`)} fill={`url(#${textureId})`}/>
        <use href={imageResourceUrl(`${artwork}#selected-rim`)} fill="none" stroke="#394818" strokeWidth="1.2"/>
        <use href={imageResourceUrl(`${artwork}#selected-frame`)} fill="#998052"/>
      </> : <>
        <defs>
          <linearGradient id={faceId} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--mode-tab-top)"/>
            <stop offset=".6" stopColor="var(--mode-tab-face)"/>
            <stop offset="1" stopColor="var(--mode-tab-bottom)"/>
          </linearGradient>
        </defs>
        <use href={imageResourceUrl(`${artwork}#mode-${shape}`)} fill="#192b38" transform="translate(.6 1.7)"/>
        <use href={imageResourceUrl(`${artwork}#mode-${shape}`)} fill={`url(#${faceId})`} stroke="#102225"
          strokeWidth="1.5" strokeLinejoin="round"/>
        <use href={imageResourceUrl(`${artwork}#pill-highlight`)} fill="#fffde6" opacity=".86"/>
        <use href={imageResourceUrl(`${artwork}#pill-bevel`)} fill="var(--mode-tab-bottom)"/>
      </>}
    </svg>
    {!active && <img className="game-mode-tab-icon"
      src={imageResourceUrl(`/ui/map-selector/mode-icons/${MODE_ICONS[mode]}.png`)}
      alt="" aria-hidden="true" draggable={false}/>}
    <span className="game-mode-tab-label">{MODE_LABELS[mode]}</span>
  </button>;
}
