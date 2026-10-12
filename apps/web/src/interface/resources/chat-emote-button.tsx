import {imageResourceUrl} from '../../assets/image-cache';
import type {ComponentPropsWithoutRef} from 'react';
import {useButtonInteraction} from './button-interaction';
import './chat-emote-button.css';

/** The smile keeps the original red, yellow and cyan interaction states. */
export function ChatEmoteButton({className = '', ...props}:
  Omit<ComponentPropsWithoutRef<'button'>, 'children'>) {
  const {element, buttonProps, state, pushed, hovering} = useButtonInteraction(props);
  return <button {...buttonProps} ref={element} className={`chat-emote-button ${className}`}
    data-source-button-state={state} data-source-pushed={String(pushed)}
    data-source-hovering={String(hovering)}>
    {['normal', 'hover', 'pressed'].map(appearance => <img key={appearance}
      className={`chat-emote-art chat-emote-art-${appearance}`}
      src={imageResourceUrl(`/ui/chat/emote-button-${appearance}.svg`)} alt="" aria-hidden="true" draggable={false}/>)}
  </button>;
}
