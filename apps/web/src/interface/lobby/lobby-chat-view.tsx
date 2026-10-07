import {LobbyChatChannel} from './lobby-chat-channel';
import {LobbyChatEmotes} from './lobby-chat-emotes';
import {LobbyChatIntimate} from './lobby-chat-intimate';
import {LobbyChatHistory} from './lobby-chat-history';
import {LobbyChatSourceCaret} from './lobby-chat-source-caret';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps, useSourceUi} from './source-react';
import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {LobbyChat} from '../../network/lobby-chat';
import type {LobbyPresence} from '../../network/lobby-presence';
import './lobby-chat.css';

/** Coordinates use the original chat.xml within the lobby's 800×600 sheet. */
const emptyPresence = {players: [], status: '', loading: false, inRoom: false};
const emptyPresenceSnapshot = () => emptyPresence;
const emptyPresenceSubscribe = () => () => {};

export function LobbyChatView({chat, presence}: {chat: LobbyChat;
  presence?: Pick<LobbyPresence, 'getSnapshot' | 'subscribe'>;
}) {
  const {ui} = useSourceUi(true, ['chat.xml', 'chat_channellist_lobby.xml', 'chat_emotelist.xml', 'chat_intimatelist.xml']);
  const layout = ui ? new HomeSourceLayout(ui, 'chat.xml') : undefined;
  const state = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
  const family = useSyncExternalStore(chat.family.subscribe, chat.family.getSnapshot);
  const directory = useSyncExternalStore(presence?.subscribe ?? emptyPresenceSubscribe, presence?.getSnapshot ?? emptyPresenceSnapshot);
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null), target = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<'emote' | 'intimate'>();
  const closeEmotes = useCallback(() => setMenu(value => value === 'emote' ? undefined : value), []);
  const closeIntimate = useCallback(() => setMenu(value => value === 'intimate' ? undefined : value), []);
  useEffect(() => {void chat.connect();}, [chat]);
  if (state.inRoom) return null;
  const familyStatus = state.channel === 'family'
    ? family.loading ? '正在读取家族…' : family.status || (family.membership ? `家族：${family.membership.name}` : '未加入家族')
    : '';
  return <section className="lobby-chat" aria-label="大厅聊天" onKeyDownCapture={event => {
    if (event.key === 'Escape' && menu) {
      event.preventDefault(); event.stopPropagation();
      if (!composing.current && !event.nativeEvent.isComposing) {
        setMenu(undefined); document.querySelector<HTMLButtonElement>(menu === 'emote'
          ? '[data-lobby-emote-toggle]' : '[data-lobby-intimate-toggle]')?.focus();
      }
    }
  }} onKeyDown={event => {
    if (event.target instanceof Element && event.target.closest('[data-lobby-emote-menu], [data-lobby-emote-toggle], [data-lobby-intimate-menu], [data-lobby-intimate-toggle]')) event.stopPropagation();
  }} onKeyUp={event => {
    if (menu || event.target instanceof Element && event.target.closest('[data-lobby-emote-menu], [data-lobby-emote-toggle], [data-lobby-intimate-menu], [data-lobby-intimate-toggle]')) event.stopPropagation();
  }}>
    <LobbyChatHistory ui={ui} messages={state.messages}/>
    {ui && layout && <>
      <SourceStaticImage ui={ui} layout={layout} suffix="chat.xml"
        name={state.channel !== 'whisper' ? 'picNormalChat' : 'tiao'} className="lobby-source-picture"/>
      <LobbyChatChannel ui={ui} channel={state.channel} pending={state.pending}
        change={value => {setMenu(undefined); chat.setChannel(value);}} focusInput={() => input.current?.focus()}/>
      <LobbyChatEmotes ui={ui} open={menu === 'emote'} pending={state.pending} composing={composing} input={input}
        close={closeEmotes} toggle={() => setMenu(value => value === 'emote' ? undefined : 'emote')} insert={(glyph, caret) => {
          const end = input.current?.selectionEnd ?? caret;
          const draft = state.draft.slice(0, caret) + glyph + state.draft.slice(end);
          if (draft.length > 72) return;
          chat.setDraft(draft); closeEmotes();
          requestAnimationFrame(() => {input.current?.focus(); input.current?.setSelectionRange(caret + glyph.length, caret + glyph.length);});
        }} />
      {state.channel === 'whisper' && <>
        <input ref={target} {...sourceProps(ui, layout, 'chat.xml', 'edtIntimateNameInput')} data-lobby-whisper-target
          data-target-account={state.targetAccountId} aria-label="密语对象昵称" autoComplete="off"
          value={state.targetName} disabled={state.pending} onChange={event => chat.setTargetName(event.currentTarget.value)}
          onCompositionStart={() => {composing.current = true;}}
          onCompositionEnd={() => {composing.current = false;}}
          onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}/>
        <LobbyChatSourceCaret input={target} ui={ui} layout={layout} name="edtIntimateNameInput" value={state.targetName}/>
        <LobbyChatIntimate ui={ui} players={directory.players} status={directory.status}
          selected={state.targetAccountId} open={menu === 'intimate'} pending={state.pending} composing={composing}
          close={closeIntimate} toggle={() => setMenu(value => value === 'intimate' ? undefined : 'intimate')}
          choose={player => {
            const start = input.current?.selectionStart ?? state.draft.length;
            const end = input.current?.selectionEnd ?? start;
            chat.chooseTarget(player); closeIntimate();
            requestAnimationFrame(() => {input.current?.focus(); input.current?.setSelectionRange(start, end);});
          }} />
      </>}
    </>}
    <form onSubmit={event => {event.preventDefault(); if (!composing.current) void chat.sendDraft();}}>
      <input ref={input} {...(ui && layout ? sourceProps(ui, layout, 'chat.xml', state.channel !== 'whisper' ? 'edtNormalUserInput' : 'edtIntimateChatInput') : {})} data-lobby-chat-input="" aria-label={state.channel === 'family' ? '家族聊天内容' : state.channel === 'friend' ? '好友聊天内容' : state.channel === 'public' ? '大厅聊天内容' : state.channel === 'gm' ? 'GM问题内容' : '密语内容'} autoComplete="off" maxLength={72}
        value={state.draft} onChange={event => chat.setDraft(event.currentTarget.value)}
        onCompositionStart={() => {composing.current = true;}}
        onCompositionEnd={() => {composing.current = false;}}
        onKeyDown={event => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            if (!event.repeat && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229) void chat.sendDraft();
          } else if (event.key === 'Escape') {event.preventDefault(); input.current?.blur();}
        }} onKeyUp={event => event.stopPropagation()}/>
      {ui && layout && <LobbyChatSourceCaret input={input} ui={ui} layout={layout}
        name={state.channel === 'whisper' ? 'edtIntimateChatInput' : 'edtNormalUserInput'} value={state.draft}/>}
    </form>
    <output data-lobby-chat-status="" role="status">{state.status || familyStatus}</output>
  </section>;
}
