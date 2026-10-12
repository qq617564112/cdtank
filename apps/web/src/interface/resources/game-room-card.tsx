import {imageResourceUrl} from '../../assets/image-cache';
import type {ComponentPropsWithoutRef} from 'react';
import {useButtonInteraction} from './button-interaction';
import './game-room-card.css';

export type GameRoomCardAnimal = 'cat' | 'dog';

interface GameRoomCardProps extends ComponentPropsWithoutRef<'button'> {
  animal: GameRoomCardAnimal;
}

export function GameRoomCard({animal, className = '', children, ...props}: GameRoomCardProps) {
  const {element, buttonProps, state, pushed, hovering} = useButtonInteraction(props);
  const artwork = `/ui/lobby/room-cards/${animal}.svg`;
  return <button {...buttonProps} ref={element} className={`game-room-card ${className}`}
    data-room-card-animal={animal} data-source-button-state={state}
    data-source-pushed={String(pushed)} data-source-hovering={String(hovering)}>
    <svg className="game-room-card-silhouette" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <use className="game-room-card-shadow" href={imageResourceUrl(`${artwork}#shadow`)}/>
      <use className="game-room-card-fill" href={imageResourceUrl(`${artwork}#contour`)}/>
    </svg>
    {children}
  </button>;
}
