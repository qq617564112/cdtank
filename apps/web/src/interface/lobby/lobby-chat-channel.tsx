import {useEffect, useRef, useState} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';

/** Original lobby channel images; account channel routing is rebuilt. */
export function LobbyChatChannel({ui, channel, pending, change, focusInput}: {
  ui: HomeSourceUi; channel: 'public' | 'whisper' | 'friend' | 'gm'; pending: boolean;
  change: (channel: 'public' | 'whisper' | 'friend' | 'gm') => void; focusInput: () => void;
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
  const menu = new HomeSourceLayout(ui, 'chat_channellist_lobby.xml');
  return <>
    <SourceButton ui={ui} layout={layout} suffix="chat.xml"
      source={channel === 'public' ? 'btnPublicChannel' : channel === 'friend' ? 'btnFriendChannel'
        : channel === 'gm' ? 'btnGMChannel' : 'btnPrivateChannel'}
      data-lobby-channel-toggle aria-label="聊天频道" aria-haspopup="menu" aria-expanded={open}
      disabled={pending} onClick={() => setOpen(value => !value)}/>
    {open && <div ref={menuElement} data-lobby-channel-menu role="menu" className="lobby-channel-menu"
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); setOpen(false); document.querySelector<HTMLButtonElement>('[data-lobby-channel-toggle]')?.focus();}
      }} onKeyUp={event => event.stopPropagation()}>
      {['all', 'biaoqingfuhaokuang'].map(name =>
        <SourceStaticImage key={name} ui={ui} layout={menu} suffix="chat_channellist_lobby.xml" name={name}
          offsetX={-6} offsetY={-48} aria-hidden="true" />)}
      {([['rdoPublic', 'public', '大厅公共'], ['rdoPrivate', 'whisper', '密语'],
        ['rdoFriend', 'friend', '好友'], ['rdoGM', 'gm', 'GM问题']] as const).map(([source, value, label]) =>
        <SourceButton key={source} ui={ui} layout={menu} suffix="chat_channellist_lobby.xml" source={source}
          offsetX={-6} offsetY={-48} role="menuitemradio" aria-label={label}
          data-lobby-channel={value} aria-checked={channel === value}
          selected={channel === value} disabled={pending}
          onClick={() => {change(value); setOpen(false); focusInput();}}/>) }
    </div>}
  </>;
}
