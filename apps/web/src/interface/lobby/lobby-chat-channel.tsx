import {useEffect, useRef, useState} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {GameButton} from '../resources/game-button';
import {sourceProps} from '../resources/source-ui-props';
import {LOBBY_CHAT_INPUT_BOUNDS, LOBBY_CONTROL_LEFT} from './lobby-source-geometry';

/** Lobby channels share a native text menu and the chat input toggle. */
export function LobbyChatChannel({ui, channel, pending, change, focusInput}: {
  ui: HomeSourceUi; channel: 'public' | 'whisper' | 'friend' | 'gm' | 'family'; pending: boolean;
  change: (channel: 'public' | 'whisper' | 'friend' | 'gm' | 'family') => void; focusInput: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) menuElement.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]:enabled')?.focus();
  }, [open]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-lobby-channel-menu], [data-lobby-channel-toggle]')) setOpen(false);
    };
    const blur = () => setOpen(false);
    window.addEventListener('pointerdown', outside); window.addEventListener('blur', blur);
    return () => {window.removeEventListener('pointerdown', outside); window.removeEventListener('blur', blur);};
  }, []);
  const layout = new HomeSourceLayout(ui, 'chat.xml');
  const source = channel === 'public' ? 'btnPublicChannel' : channel === 'family' ? 'btnFamilyChannel'
    : channel === 'friend' ? 'btnFriendChannel' : channel === 'gm' ? 'btnGMChannel' : 'btnPrivateChannel';
  const label = {public: '聊天', family: '家族', friend: '好友', gm: 'GM', whisper: '密语'}[channel];
  const position = sourceProps(ui, layout, 'chat.xml', source);
  return <>
    <GameButton {...position} tone="red" shape="chat" className="lobby-channel-button"
      style={{...position.style, left: LOBBY_CONTROL_LEFT,
        top: LOBBY_CHAT_INPUT_BOUNDS.top + (LOBBY_CHAT_INPUT_BOUNDS.height - Number(position.style.height)) / 2}}
      data-lobby-channel-toggle aria-label="聊天频道" aria-haspopup="menu" aria-expanded={open}
      disabled={pending} onClick={() => setOpen(value => !value)}>{label}</GameButton>
    {open && <div ref={menuElement} data-lobby-channel-menu role="menu" aria-label="聊天频道"
      className="lobby-channel-menu" style={{left: LOBBY_CONTROL_LEFT, top: LOBBY_CHAT_INPUT_BOUNDS.top}}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); setOpen(false); document.querySelector<HTMLButtonElement>('[data-lobby-channel-toggle]')?.focus();}
      }} onKeyUp={event => event.stopPropagation()}>
      {([['public', '聊天', '大厅公共'], ['whisper', '密语', '密语'],
        ['friend', '好友', '好友'], ['gm', 'GM', 'GM问题'], ['family', '家族', '家族']] as const)
        .map(([value, label, description]) => <button key={value} type="button"
          className="lobby-channel-option" role="menuitemradio" aria-label={description}
          data-lobby-channel={value} aria-checked={channel === value} disabled={pending}
          onClick={() => {change(value); setOpen(false); focusInput();}}>{label}</button>)}
    </div>}
  </>;
}
