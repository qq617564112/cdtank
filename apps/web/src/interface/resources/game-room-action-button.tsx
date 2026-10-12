import {imageResourceUrl} from '../../assets/image-cache';
import {useId, type ComponentPropsWithoutRef} from 'react';
import {useButtonInteraction} from './button-interaction';
import {GameSurfaceTexture} from './game-surface-texture';
import './game-room-action-button.css';

const ROOM_ACTIONS = {
  details: {width: 68, height: 27, artwork: 'sign'},
  kick: {width: 68, height: 27, artwork: 'sign'},
  'add-robot': {width: 179, height: 39, artwork: 'robot'},
  ready: {width: 156, height: 50, artwork: 'ready'},
  cancel: {width: 156, height: 50, artwork: 'ready'},
} as const;

interface GameRoomActionButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant: keyof typeof ROOM_ACTIONS;
}

/** Wooden slot actions, pale empty slots and ready controls retain their source artwork. */
export function GameRoomActionButton({variant, className = '', style, children, ...props}: GameRoomActionButtonProps) {
  const {element, buttonProps, state} = useButtonInteraction(props);
  const textureId = useId();
  const {width, height, artwork} = ROOM_ACTIONS[variant];
  const resource = '/ui/lobby/waiting-buttons.svg';
  return <button {...buttonProps} ref={element} className={`game-room-action-button ${className}`}
    data-room-action={variant} data-source-button-state={state} style={{width, height, ...style}}>
    <svg className="game-room-action-art" viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {artwork === 'sign' ? <>
        <GameSurfaceTexture id={textureId} tone="panel-gold" size={{width, height}}/>
        <use href={imageResourceUrl(`${resource}#sign-shadow`)} fill="#302618" opacity=".8"/>
        <use className="game-room-sign-face" href={imageResourceUrl(`${resource}#sign-face`)} fill={`url(#${textureId})`}
          stroke="#272214" strokeWidth="1.1" strokeLinejoin="round"/>
        <use href={imageResourceUrl(`${resource}#sign-light`)} fill="#e6cf92" opacity=".42"/>
        <use href={imageResourceUrl(`${resource}#sign-cracks`)} fill="#292416"/>
      </> : artwork === 'robot' ? <>
        <use href={imageResourceUrl(`${resource}#robot-rim`)} fill="var(--room-action-rim)"/>
        <use href={imageResourceUrl(`${resource}#robot-face`)} fill="var(--room-action-face)"/>
        <use href={imageResourceUrl(`${resource}#robot-light`)} fill="#fff9dd" opacity=".72"/>
      </> : <>
        <use href={imageResourceUrl(`${resource}#ready-outline`)} fill="#121528" stroke="#121528" strokeWidth="1.1"/>
        <use href={imageResourceUrl(`${resource}#ready-face`)} fill="var(--room-action-face)"/>
        <use href={imageResourceUrl(`${resource}#ready-light`)} fill="var(--room-action-light)"/>
        <use href={imageResourceUrl(`${resource}#ready-bevel`)} fill="var(--room-action-bevel)"/>
        <use href={imageResourceUrl(`${resource}#ready-side`)} fill="var(--room-action-side)"/>
      </>}
    </svg>
    <span className="game-room-action-label">{children}</span>
  </button>;
}
