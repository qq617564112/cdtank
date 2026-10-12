import {GameMessage} from '../resources/game-message';
import './source-battle-chat.css';
import {useEffect, useRef, useState, type ReactNode, type RefObject} from 'react';
import type {ChatSourceLayout} from './source-chat-layout';
import {SourceChatEmotes} from './source-chat-emotes';
import type {RoomIntimatePlayer} from './source-chat-intimate';
import {GameSurfacePanel} from '../resources/game-surface-panel';
import {GameButton} from '../resources/game-button';

export interface SourceChatResources {
  layout: ChatSourceLayout; channels: ChatSourceLayout; emotes: ChatSourceLayout;
}

const CHANNELS = ['聊天', '队伍', '密语', '好友', 'GM', '家族'];
const CHANNEL_CONTROLS = ['btnPublic', 'btnTeam', 'btnPrivate', 'btnFriend', 'btnGM', 'btnFamily'];
const CHANNEL_ORDER = [0, 1, 3, 2, 4, 5] as const;

/** Painted chat frames contain native messages, channel choices and editor controls. */
export function SourceBattleChat({resources, active, channel, pending, composing, input, changeChannel,
  insert, releaseKeys, players, selectedName, chooseTarget, children}: {
  resources?: SourceChatResources; active: boolean; channel: 0 | 1 | 2 | 3 | 4 | 5; pending: boolean;
  composing: RefObject<boolean>; input: RefObject<HTMLInputElement | null>;
  changeChannel: (channel: 0 | 1 | 2 | 3 | 4 | 5) => void; insert: (glyph: string, caret: number) => void;
  releaseKeys: () => void; children: ReactNode;
  players: readonly RoomIntimatePlayer[]; selectedName: string; chooseTarget: (name: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<'channel' | 'emote' | 'intimate'>();
  const [scale, setScale] = useState(() => Math.min(innerWidth / 800, innerHeight / 600));
  useEffect(() => {
    const resize = () => setScale(Math.min(innerWidth / 800, innerHeight / 600));
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !stage.current?.contains(event.target)) setMenu(undefined);
    };
    const blur = () => setMenu(undefined);
    window.addEventListener('resize', resize);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('source-chat-active', active);
    if (!active) setMenu(undefined);
    return () => document.body.classList.remove('source-chat-active');
  }, [active]);
  const toggle = (value: 'channel' | 'emote' | 'intimate') => {
    if (pending || composing.current) return;
    releaseKeys(); setMenu(current => current === value ? undefined : value);
    requestAnimationFrame(() => stage.current?.querySelector<HTMLButtonElement>(
      value === 'channel' ? '[data-chat-source-channel]' : '[data-room-intimate-player]')?.focus());
  };
  return <div ref={stage} className="source-chat-stage" style={{transform: `scale(${scale})`}}
    data-chat-renderer="html" data-chat-whisper={channel === 2 || undefined}
    onPointerDownCapture={event => {
      if (composing.current && event.target instanceof Element && event.target.closest('button')) {
        event.preventDefault(); event.stopPropagation();
      }
    }}
    onClickCapture={event => {
      if (composing.current && event.target instanceof Element && event.target.closest('button')) {
        event.preventDefault(); event.stopPropagation();
      }
    }}
    onPointerDown={releaseKeys}
    onKeyDownCapture={event => {
      if (menu && event.key === 'Escape' && !event.nativeEvent.isComposing && !composing.current) {
        event.preventDefault(); event.stopPropagation(); setMenu(undefined);
        stage.current?.querySelector<HTMLButtonElement>(`[data-source-control="${menu === 'intimate'
          ? 'btnExpandIntimate' : menu === 'emote' ? 'btnExpandEmotion' : CHANNEL_CONTROLS[channel]}"]`)?.focus();
      }
    }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <svg className="battle-chat-frame" viewBox="0 0 300 107" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M1 10Q1 5 6 3L11 1H289L295 3Q299 5 299 11V96Q299 102 294 104L289 106H11L5 104Q1 102 1 96Z"
        fill="#080036" fillOpacity=".72"/>
      <path d="M3 11Q3 7 8 4H291Q296 5 297 10" fill="none" stroke="#161044" strokeOpacity=".65" strokeWidth="1"/>
      <path d="M3 96Q4 103 11 104H290Q296 103 297 97" fill="none" stroke="#070024" strokeOpacity=".65" strokeWidth="1"/>
    </svg>
    {active && <GameSurfacePanel shape="chat-input" className="battle-chat-input-panel"
      style={{left: 0, top: 127, width: 301, height: 37}} aria-hidden="true"/>}
    {active && channel === 2 && <span className="battle-chat-input-divider" aria-hidden="true"/>}
    {children}
    {resources && active && <>
      <GameButton tone="red" shape="chat" className="battle-chat-channel-toggle" style={{left: 2, top: 134, width: 47, height: 25}}
        data-source-control={CHANNEL_CONTROLS[channel]}
        disabled={pending} aria-label={`${CHANNELS[channel]}聊天频道`} aria-haspopup="menu" aria-expanded={menu === 'channel'}
        onClick={() => toggle('channel')}>{CHANNELS[channel]}</GameButton>
      <div className="source-chat-channel-menu battle-chat-menu" data-source-chat-menu="" role="menu"
        hidden={menu !== 'channel'} aria-label="聊天频道">
        {CHANNEL_ORDER.map((value, index) => <button key={value} type="button" role="menuitemradio"
          data-chat-source-channel={value} aria-checked={value === channel} disabled={pending}
          onKeyDown={event => {
            const next = event.key === 'ArrowDown' ? CHANNEL_ORDER[(index + 1) % CHANNEL_ORDER.length]
              : event.key === 'ArrowUp' ? CHANNEL_ORDER[(index + CHANNEL_ORDER.length - 1) % CHANNEL_ORDER.length] : undefined;
            if (next === undefined) return;
            event.preventDefault(); stage.current?.querySelector<HTMLButtonElement>(`[data-chat-source-channel="${next}"]`)?.focus();
          }} onClick={() => {
            if (composing.current) return;
            changeChannel(value as 0 | 1 | 2 | 3 | 4 | 5); setMenu(undefined); input.current?.focus();
          }}>{CHANNELS[value]}</button>)}
      </div>
      {channel === 2 && <>
        <button type="button" className="battle-chat-target-toggle" data-source-control="btnExpandIntimate"
          data-room-intimate-toggle="" aria-label="选择密语对象" aria-haspopup="listbox"
          aria-expanded={menu === 'intimate'} disabled={pending} onClick={() => toggle('intimate')}>
          <svg viewBox="0 0 13 24" aria-hidden="true" focusable="false"><path d="M3 8L10 12 3 16Z" fill="currentColor" stroke="#3b2b19"/></svg>
        </button>
        {menu === 'intimate' && <div className="battle-chat-target-menu battle-chat-menu" data-room-intimate-menu=""
          role="listbox" aria-label="当前房间密语对象">
          {players.map((player, index) => <button key={player.id} type="button" role="option"
            data-room-intimate-player={player.id} aria-selected={player.name === selectedName} disabled={pending}
            onKeyDown={event => {
              const next = event.key === 'ArrowDown' ? Math.min(index + 1, players.length - 1)
                : event.key === 'ArrowUp' ? Math.max(index - 1, 0) : undefined;
              if (next === undefined) return;
              event.preventDefault(); stage.current?.querySelector<HTMLButtonElement>(`[data-room-intimate-player="${players[next].id}"]`)?.focus();
            }} onClick={() => {
              if (composing.current) return;
              chooseTarget(player.name); setMenu(undefined); input.current?.focus();
            }}>{player.name}</button>)}
          {!players.length && <GameMessage text="当前房间名单未取得"/>}
        </div>}
      </>}
      <SourceChatEmotes layout={resources.layout} menuLayout={resources.emotes} pending={pending}
        composing={composing} input={input} open={menu === 'emote'} toggle={() => toggle('emote')}
        close={() => setMenu(undefined)} insert={insert} releaseKeys={releaseKeys}/>
    </>}
  </div>;
}
