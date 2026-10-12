import {imageResourceUrl} from '../../assets/image-cache';
import type {ComponentPropsWithoutRef} from 'react';
import type {GameRoomCardAnimal} from '../resources/game-room-card';
import '../resources/happy-zcool.css';

const MODE_BADGES = [
  {name: '团队', image: 'team'},
  {name: '占领', image: 'occupation'},
  {name: '擒王', image: 'king'},
  {name: '混战', image: 'melee'},
  {name: '破坏', image: 'destruction'},
];

export function roomCardModeName(mode: number): string {
  return MODE_BADGES[mode - 1]?.name ?? String(mode);
}

export function RoomCardModeBadge({mode, className = '', ...props}:
  ComponentPropsWithoutRef<'span'> & {mode: number}) {
  const badge = MODE_BADGES[mode - 1];
  const label = badge ? `${badge.name}模式` : String(mode);
  return <span {...props} className={`room-card-mode-badge ${className}`}
    data-room-card-mode={mode} title={label} aria-label={label}>
    {badge && <img className="room-card-mode-artwork" src={imageResourceUrl(`/ui/lobby/room-cards/mode-${badge.image}.png`)}
      alt="" aria-hidden="true" draggable={false}/>}
    <span className="room-card-mode-label">{label}</span>
  </span>;
}

export function RoomCardFactionPortrait({faction, className = '', ...props}:
  ComponentPropsWithoutRef<'span'> & {faction: GameRoomCardAnimal}) {
  return <span {...props} className={`room-card-faction-portrait ${className}`}>
    <img src={imageResourceUrl(`/ui/lobby/room-cards/faction-${faction}.png`)} alt="" aria-hidden="true" draggable={false}/>
  </span>;
}
