import './waiting-chat-source.css';
import {useEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {emoteGlyph} from './chat-emote-text';
import {SourceChatIntimate, type RoomIntimatePlayer} from './source-chat-intimate';

/** The waiting sheet consumes the existing room-chat session and original chat layouts. */
export function WaitingChatSourceView({ui, scale, channel, pending, composing, input, changeChannel,
  insert, releaseKeys, players, selectedName, chooseTarget, children}: {
  ui: HomeSourceUi; scale: number; channel: 0 | 1 | 2 | 3 | 4 | 5; pending: boolean;
  composing: RefObject<boolean>; input: RefObject<HTMLInputElement | null>;
  changeChannel: (channel: 0 | 1 | 2 | 3 | 4 | 5) => void; insert: (glyph: string, caret: number) => void;
  releaseKeys: () => void; children: ReactNode;
  players: readonly RoomIntimatePlayer[]; selectedName: string; chooseTarget: (name: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const compositionClick = useRef(false);
  const [menu, setMenu] = useState<'channel' | 'emote' | 'intimate'>();
  const layout = new HomeSourceLayout(ui, 'chat.xml');
  const channels = new HomeSourceLayout(ui, 'chat_channellist.xml');
  const emotes = new HomeSourceLayout(ui, 'chat_emotelist.xml');
  const toggleName = ['btnPublicChannel', 'btnTeamChannel', 'btnPrivateChannel', 'btnFriendChannel', 'btnGMChannel', 'btnFamilyChannel'][channel];
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-waiting-chat-channel-menu], [data-waiting-chat-emote-menu], [data-waiting-chat-toggle], [data-waiting-chat-emotes], [data-room-intimate-menu], [data-room-intimate-toggle]')) setMenu(undefined);
    };
    const blur = () => setMenu(undefined);
    window.addEventListener('pointerdown', outside); window.addEventListener('blur', blur);
    return () => {window.removeEventListener('pointerdown', outside); window.removeEventListener('blur', blur);};
  }, []);
  const toggle = (kind: 'channel' | 'emote' | 'intimate') => {
    if (pending || composing.current) return;
    releaseKeys(); setMenu(value => value === kind ? undefined : kind);
    if (kind !== 'intimate') requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(kind === 'channel'
      ? `[data-waiting-chat-channel="${channel}"]` : '[data-waiting-emote-choice]')?.focus());
  };
  const dismiss = (name: string) => {
    setMenu(undefined);
    root.current?.querySelector<HTMLButtonElement>(`[data-source-control="${name}"]`)?.focus();
  };
  return <div ref={root} className="waiting-chat-stage" data-waiting-chat-stage="" style={{transform: `scale(${scale})`}}
    onPointerDownCapture={event => {
      if (event.target instanceof Element && event.target.closest('[data-waiting-chat-emotes], [data-room-intimate-toggle]')) {
        compositionClick.current = composing.current;
        if (compositionClick.current) event.preventDefault();
      }
    }} onClickCapture={event => {
      if ((compositionClick.current || composing.current) && event.target instanceof Element && event.target.closest('[data-waiting-chat-emotes], [data-room-intimate-toggle]')) {
        compositionClick.current = false; event.preventDefault(); event.stopPropagation();
      }
    }} onPointerCancelCapture={() => {compositionClick.current = false;}} onKeyDownCapture={event => {
      if (event.key === 'Escape' && menu) {
        event.preventDefault();
        event.stopPropagation();
        if (!composing.current && !event.nativeEvent.isComposing) {
          dismiss(menu === 'channel' ? toggleName : menu === 'intimate' ? 'btnExpandIntimate' : 'btnExpandEmotion');
        }
      }
    }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <SourceImageScale value={scale}>
      {['SheetWindow', 'lt', 'liaotiankuangditu', 'paomadengditu',
        ...(channel === 2 ? ['picIntimateChat', 'tiao'] : ['picNormalChat'])].map(name =>
        <SourceStaticImage key={name} ui={ui} layout={layout} suffix="chat.xml" name={name} offsetY={-402}
          className="waiting-chat-picture" aria-hidden="true" />)}
      {children}
      <SourceButton ui={ui} layout={layout} suffix="chat.xml" source={toggleName} offsetY={-402}
        data-waiting-chat-toggle="" aria-label="房间聊天频道" aria-haspopup="menu" aria-expanded={menu === 'channel'}
        disabled={pending} onClick={() => toggle('channel')} />
      <SourceButton ui={ui} layout={layout} suffix="chat.xml" source="btnExpandEmotion" offsetY={-402}
        aria-label="插入表情" data-waiting-chat-emotes="" aria-haspopup="menu" aria-expanded={menu === 'emote'}
        disabled={pending} onClick={() => toggle('emote')} />
      {channel === 2 && <SourceButton ui={ui} layout={layout} suffix="chat.xml" source="btnExpandIntimate" offsetY={-402}
        data-room-intimate-toggle="" aria-label="选择密语对象" aria-haspopup="listbox" aria-expanded={menu === 'intimate'}
        disabled={pending} onClick={() => toggle('intimate')} />}
      {channel === 2 && menu === 'intimate' && <SourceChatIntimate ui={ui} waiting players={players}
        selectedName={selectedName} pending={pending} composing={composing}
        choose={name => {chooseTarget(name); setMenu(undefined);}} />}
      {menu === 'channel' && <div className="waiting-chat-channel-menu" data-waiting-chat-channel-menu="" role="menu">
        {['all', 'biaoqingfuhaokuang'].map(name => <SourceStaticImage key={name} ui={ui} layout={channels}
          suffix="chat_channellist.xml" name={name} className="waiting-chat-picture" aria-hidden="true" />)}
        {([['rdoPublic', '房间', 0], ['rdoTeam', '队伍', 1], ['rdoFriend', '好友', 3],
          ['rdoPrivate', '密语', 2], ['rdoGM', '联系GM', 4]] as const).map(([name, label, value]) =>
          <SourceButton key={name} ui={ui} layout={channels} suffix="chat_channellist.xml" source={name}
            role="menuitemradio" aria-label={label} selected={channel === value} aria-checked={channel === value}
            data-waiting-chat-channel={value} disabled={pending}
            onClick={() => {releaseKeys(); changeChannel(value); setMenu(undefined); input.current?.focus();}} />)}
        <button type="button" className="waiting-chat-family-option" role="menuitemradio"
          aria-label="家族" aria-checked={channel === 5} data-waiting-chat-channel="5" disabled={pending}
          onClick={() => {releaseKeys(); changeChannel(5); setMenu(undefined); input.current?.focus();}}>家族</button>
      </div>}
      {menu === 'emote' && <div className="waiting-chat-emote-menu" data-waiting-chat-emote-menu="" role="menu">
        {['all', 'biaoqingfuhaokuang'].map(name => <SourceStaticImage key={name} ui={ui} layout={emotes}
          suffix="chat_emotelist.xml" name={name} className="waiting-chat-picture" aria-hidden="true" />)}
        {Array.from({length: 30}, (_, index) => index + 1).map(id => {
          const name = String(id).padStart(3, '0');
          return <button type="button" key={id} {...sourceProps(ui, emotes, 'chat_emotelist.xml', name, emotes.control(name).properties.Image)}
            role="menuitem" data-waiting-emote-choice={id} aria-label={`表情${name}`} disabled={pending}
            onClick={() => {if (!pending && !composing.current && input.current) {
              insert(emoteGlyph(id), input.current.selectionStart ?? input.current.value.length);
            }}} />;
        })}
      </div>}
    </SourceImageScale>
  </div>;
}
