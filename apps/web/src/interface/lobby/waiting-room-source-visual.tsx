import {useRef, type ComponentPropsWithoutRef} from 'react';
import {DialogButton} from '../resources/dialog-button';
import {GameButton, type GameButtonShape, type GameButtonTone} from '../resources/game-button';
import {GameScrollbar} from '../resources/game-scrollbar';
import {GameSurfacePanel} from '../resources/game-surface-panel';
import {GameRoomActionButton} from '../resources/game-room-action-button';
import {sourceProps} from '../resources/source-ui-props';
import type {HomeSourceLayout, HomeSourceUi} from '../resources/source-ui-layout';

export {HomeStaticText as WaitingRoomText} from '../home/home-text';

interface WaitingRoomSourceProps {ui: HomeSourceUi; layout: HomeSourceLayout;}

const SURFACES = [
  ['ditu', 'waiting-sheet'], ['maogouditu', 'waiting-roster'], ['maogouditu2', 'waiting-roster'],
  ['zhongjianditu', 'waiting-details'], ['fenhongdi1', 'waiting-rules'], ['kuang', 'waiting-description'],
] as const;

/** Original control bounds surround one continuous textured surface per panel. */
export function WaitingRoomSurfaces({ui, layout}: WaitingRoomSourceProps) {
  return SURFACES.map(([name, shape]) => {
    const bounds = sourceProps(ui, layout, 'room_main.xml', name);
    return <GameSurfacePanel key={name} {...bounds} shape={shape} className="waiting-room-surface"
      style={{...bounds.style, ...(name === 'ditu' ? {width: 615} : name === 'fenhongdi1' ? {height: 258} : {})}}
      aria-hidden="true"/>;
  });
}

const INFO_ROW_CENTERS = {
  dituguize: 89.5, renshu: 107.5, daos: 107.5, txtMinPlayer: 107.5, txtMaxPlayer: 107.5,
  meijushijian: 170.5, sec: 170.5, txtGameTime: 170.5,
} as const;

/** Labels and values use the same center within each painted information strip. */
export function WaitingRoomInfoText({ui, layout, name, text}: WaitingRoomSourceProps & {
  name: keyof typeof INFO_ROW_CENTERS; text: string;
}) {
  const bounds = sourceProps(ui, layout, 'room_main.xml', name);
  const width = name === 'dituguize' ? Math.max(Number(bounds.style.width), text.length * 12 + 2)
    : Number(bounds.style.width);
  const alignment = layout.control(name).properties.HorzFormatting;
  return <span {...bounds} className="home-font-text waiting-room-info-text"
    style={{...bounds.style, width, height: 20, top: INFO_ROW_CENTERS[name] - 10,
      left: Number(bounds.style.left) + (Number(bounds.style.width) - width) / 2,
      justifyContent: alignment === 'RightAligned' ? 'flex-end'
        : alignment === 'LeftAligned' || name === 'txtMaxPlayer' ? 'flex-start' : 'center', alignItems: 'center'}}>
    <span data-source-text-content="">{name === 'renshu'
      ? [...text].map((letter, index) => <span key={index}>{letter}</span>) : text}</span>
  </span>;
}

export function WaitingRoomPlayerSurface({ui, layout, index, occupied, ...props}:
  WaitingRoomSourceProps & ComponentPropsWithoutRef<'div'> & {index: number; occupied: boolean;}) {
  return <GameSurfacePanel {...sourceProps(ui, layout, 'room_main.xml', `PlayerPanel${index}`)} {...props}
    shape={occupied ? index < 6 ? 'waiting-player' : 'waiting-player-right' : 'waiting-empty'}
    className="waiting-room-player-surface"/>;
}

export function WaitingRoomDescription({ui, layout, text}: WaitingRoomSourceProps & {text: string}) {
  const list = useRef<HTMLDivElement>(null);
  const bounds = sourceProps(ui, layout, 'room_main.xml', 'edtMapDesc');
  return <div {...bounds} className="waiting-room-description-shell" style={{...bounds.style, height: 112}}>
    <div ref={list} className="waiting-room-description" role="region" aria-label="地图说明" tabIndex={0}>{text}</div>
    <GameScrollbar list={list} step={16} label="地图说明滚动条"/>
  </div>;
}

const BUTTONS = {
  btnCatTeam: {label: '加入猫队', tone: 'cyan', shape: 'team'},
  btnDogTeam: {label: '加入狗队', tone: 'red', shape: 'team'},
  btnInvite: {label: '邀请', tone: 'violet', shape: 'invite'},
} as const satisfies Record<string, {label: string; tone: GameButtonTone; shape: GameButtonShape}>;

/** Room buttons retain their original colors and share pointer and keyboard feedback. */
export function WaitingRoomButton({ui, layout, source, className = '', ...props}:
  WaitingRoomSourceProps & ComponentPropsWithoutRef<'button'> & {
    source: keyof typeof BUTTONS | 'btnReady' | 'btnCancel' | 'btnClose';
  }) {
  const bounds = sourceProps(ui, layout, 'room_main.xml', source);
  if (source === 'btnClose') return <DialogButton {...bounds} {...props} kind="close"
    className={`waiting-room-close ${className}`}/>;
  if (source === 'btnReady' || source === 'btnCancel') return <GameRoomActionButton {...bounds} {...props}
    variant={source === 'btnReady' ? 'ready' : 'cancel'} className={`waiting-room-button ${className}`}
    data-waiting-button={source}>{source === 'btnReady' ? '准备' : '取消'}</GameRoomActionButton>;
  const preset = BUTTONS[source];
  const label = source === 'btnCatTeam' || source === 'btnDogTeam'
    ? <><span className="waiting-room-team-prefix" hidden={props['aria-pressed'] === true}>加入</span>
      {source === 'btnCatTeam' ? '猫队' : '狗队'}</> : preset.label;
  return <GameButton {...bounds} {...props} tone={preset.tone} shape={preset.shape} gradient
    className={`waiting-room-button ${className}`} data-waiting-button={source}>{label}</GameButton>;
}
