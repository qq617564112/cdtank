import './source-battle-chat.css';
import {useEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import {ChatSourceLayout, SourceChatFrame} from './source-chat-layout';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceImageScale, SourceStaticImage} from '../resources/source-static-image';
import {SourceChatEmotes} from './source-chat-emotes';
import {SourceChatIntimate, type RoomIntimatePlayer} from './source-chat-intimate';

export interface SourceChatResources {
  layout: ChatSourceLayout; channels: ChatSourceLayout; emotes: ChatSourceLayout;
}

/** Source ornaments and menus. Input, messages and send state remain controlled.
 *  `active` is the editable editor; the read-only notice frame renders the ornaments only. */
export function SourceBattleChat({resources, active, channel, pending, composing, input, changeChannel,
  insert, releaseKeys, players, selectedName, chooseTarget, children}: {
  resources?: SourceChatResources; active: boolean; channel: 0 | 1 | 2 | 3; pending: boolean;
  composing: RefObject<boolean>; input: RefObject<HTMLInputElement | null>;
  changeChannel: (channel: 0 | 1 | 2 | 3) => void; insert: (glyph: string, caret: number) => void;
  releaseKeys: () => void; children: ReactNode;
  players: readonly RoomIntimatePlayer[]; selectedName: string; chooseTarget: (name: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<'channel' | 'emote' | 'intimate'>();
  const compositionClick = useRef(false);
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  useEffect(() => {
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-chat-emote-menu], [data-source-control="btnExpandEmotion"]')) return;
      if (event.target.closest('[data-room-intimate-menu], [data-room-intimate-toggle]')) return;
      if (event.target.closest('[data-source-chat-menu], [data-source-control="btnPublic"], [data-source-control="btnTeam"], [data-source-control="btnPrivate"], [data-source-control="btnFriend"]')) return;
      setMenu(undefined);
    };
    const blur = () => setMenu(undefined);
    window.addEventListener('resize', resize); window.addEventListener('pointerdown', outside); window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('resize', resize); window.removeEventListener('pointerdown', outside); window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('source-chat-active', active);
    if (!active) setMenu(undefined);
    return () => {document.body.classList.remove('source-chat-active');};
  }, [active]);
  const layout = resources?.layout;
  const sourceLayout = resources ? new HomeSourceLayout(resources.layout.ui, 'game_main_chat_shrinked.xml') : undefined;
  const channelLayout = resources ? new HomeSourceLayout(resources.channels.ui, 'game_main_channellist.xml') : undefined;
  return <div ref={stage} className="source-chat-stage" style={{transform: `scale(${scale})`}}
    onPointerDownCapture={event => {
      if (event.target instanceof Element && event.target.closest('[data-room-intimate-toggle]')) {
        compositionClick.current = composing.current;
        if (compositionClick.current) event.preventDefault();
      }
    }} onPointerCancelCapture={() => {compositionClick.current = false;}} onClickCapture={event => {
      if (event.target instanceof Element && event.target.closest('[data-room-intimate-toggle]')
          && (compositionClick.current || composing.current)) {
        compositionClick.current = false; event.preventDefault(); event.stopPropagation();
      }
    }} onKeyDownCapture={event => {
      if (active && menu && event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (!composing.current && !event.nativeEvent.isComposing) {
          const name = menu === 'intimate' ? 'btnExpandIntimate' : menu === 'emote' ? 'btnExpandEmotion'
            : channel === 3 ? 'btnFriend' : channel === 2 ? 'btnPrivate' : channel ? 'btnTeam' : 'btnPublic';
          setMenu(undefined);
          stage.current?.querySelector<HTMLButtonElement>(`[data-source-control="${name}"]`)?.focus();
        }
      }
    }} onKeyDown={event => {
      if (event.target instanceof Element && event.target.closest('[data-room-intimate-menu], [data-room-intimate-toggle]')) event.stopPropagation();
    }} onKeyUp={event => {
      if (event.target instanceof Element && event.target.closest('[data-room-intimate-menu], [data-room-intimate-toggle]')) event.stopPropagation();
    }}>
    {layout && ['liaotianlan', 'picUpperPanel', 'picLowerPanel', 'liaotianditu', channel === 2 ? 'picIntimateChat' : 'picNormalChat'].map(name => {
      const position = layout.place(name, 0, -435), image = layout.picture(layout.control(name).properties.Image);
      return <div key={name} {...position} {...image} style={{...position.style,
        ...(name === 'picUpperPanel' ? {opacity: .9} : image.style)}}>
        {name === 'picUpperPanel' && <SourceChatFrame layout={layout} name={name} width={300} height={107} kind="chat" />}
      </div>;
    })}
    {children}
    {resources && <>
      <SourceImageScale value={scale}>
      {active && channel === 2 && <>
        <SourceButton ui={resources.layout.ui} layout={sourceLayout!} suffix="game_main_chat_shrinked.xml"
          source="btnExpandIntimate" offsetY={-435} data-room-intimate-toggle="" aria-label="选择密语对象"
          aria-haspopup="listbox" aria-expanded={menu === 'intimate'} disabled={pending}
          onClick={() => {if (!pending && !composing.current) {releaseKeys(); setMenu(value => value === 'intimate' ? undefined : 'intimate');}}} />
        {menu === 'intimate' && <SourceChatIntimate ui={resources.layout.ui} waiting={false} players={players}
          selectedName={selectedName} pending={pending} composing={composing}
          choose={name => {chooseTarget(name); setMenu(undefined);}} />}
      </>}
      {(['btnPublic', 'btnTeam', 'btnPrivate', 'btnFriend'] as const).map((name, index) => <SourceButton key={name}
        ui={resources.layout.ui} layout={sourceLayout!} suffix="game_main_chat_shrinked.xml" source={name} offsetY={-435} hidden={!active || channel !== index} disabled={pending}
        aria-label={index === 3 ? '好友聊天频道' : index === 2 ? '密语频道' : index ? '队伍聊天频道' : '房间聊天频道'} aria-haspopup="menu" aria-expanded={menu === 'channel'}
        onClick={() => {
          releaseKeys();
          setMenu(value => value === 'channel' ? undefined : 'channel');
          requestAnimationFrame(() => stage.current?.querySelector<HTMLButtonElement>(`[data-chat-source-channel="${channel}"]`)?.focus());
        }} />)}
      <div className="source-chat-channel-menu" data-source-chat-menu="" role="menu" hidden={!active || menu !== 'channel'}
        onKeyDown={event => {event.stopPropagation(); if (event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); setMenu(undefined);
          stage.current?.querySelector<HTMLButtonElement>(`[data-source-control="${channel === 3 ? 'btnFriend' : channel === 2 ? 'btnPrivate' : channel ? 'btnTeam' : 'btnPublic'}"]`)?.focus();
        }}} onKeyUp={event => event.stopPropagation()}>
        {['all', 'biaoqingfuhaokuang'].map(name =>
          <SourceStaticImage key={name} ui={resources.channels.ui} layout={channelLayout!}
            suffix="game_main_channellist.xml" name={name} offsetX={-1} offsetY={-4} aria-hidden="true" />)}
        {([
          ['rdoPublic', '房间', 0], ['rdoTeam', '队伍', 1], ['rdoFriend', '好友', 3],
          ['rdoPrivate', '密语', 2], ['rdoGM', 'GM频道尚未恢复', null],
        ] as const).map(([name, label, value]) => {
          const checked = value === channel;
          return <SourceButton key={name} ui={resources.channels.ui} layout={channelLayout!}
            suffix="game_main_channellist.xml" source={name} offsetX={-1} offsetY={-4} selected={checked}
            role="menuitemradio" aria-label={label} title={value === null ? label : undefined}
            data-chat-source-channel={value ?? undefined} aria-checked={checked} disabled={value === null || pending}
            onClick={() => {if (value !== null) {changeChannel(value); setMenu(undefined); input.current?.focus();}}} />;
        })}
      </div>
      </SourceImageScale>
      {active && <SourceImageScale value={scale}><SourceChatEmotes layout={resources.layout} menuLayout={resources.emotes} pending={pending}
        composing={composing} input={input} open={menu === 'emote'} toggle={() => setMenu('emote')}
        close={() => setMenu(undefined)} insert={insert} releaseKeys={releaseKeys} /></SourceImageScale>}
    </>}
  </div>;
}
