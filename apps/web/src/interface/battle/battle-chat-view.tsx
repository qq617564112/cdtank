import './chat.css';
import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {BattleChat} from './battle-chat';
import {ChatEmotes} from './chat-emotes';
import {normalizeEmoteInput} from './chat-emote-text';
import {QUICK_CHAT_KEYS} from '../settings/quick-chat-preferences';
import type {QuickChatKey} from '../settings/quick-chat-preferences';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {ChatSourceLayout} from './source-chat-layout';
import {SourceBattleChat, type SourceChatResources} from './source-battle-chat';
import {WaitingChatSourceView} from './waiting-chat-source-view';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {SourceChatScrollbar} from './source-chat-scrollbar';
import {WaitingChatHistoryScrollbar} from './waiting-chat-history-scrollbar';
import {RoomChatSourceCaret} from './room-chat-source-caret';

export function BattleChatView({chat, formal = false}: {chat: BattleChat; formal?: boolean}) {
  const snapshot = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
  return snapshot.visible ? <BattleChatSession key={snapshot.generation} chat={chat} formal={formal} /> : null;
}

function BattleChatSession({chat, formal}: {chat: BattleChat; formal: boolean}) {
  const state = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
  const root = useRef<HTMLElement>(null), input = useRef<HTMLInputElement>(null), log = useRef<HTMLOListElement>(null);
  const targetInput = useRef<HTMLInputElement>(null);
  const composing = useRef(false), caret = useRef<number | undefined>(undefined);
  const [resources, setResources] = useState<SourceChatResources>();
  const [renderer] = useState(() => new ChatEmotes());
  const [size, setSize] = useState(() => ({width: innerWidth, height: innerHeight}));
  const active = state.sourceActive && !!resources;
  const waiting = formal && !state.sourceActive && !!resources;
  const source = active || waiting;
  useEffect(() => {
    const abort = new AbortController(); let alive = true;
    void (async () => {
      const response = await fetch('/ui.json', {signal: abort.signal});
      if (!response.ok) throw new Error('聊天布局资源缺失');
      const ui = await response.json() as HomeSourceUi;
      await loadSourceUiFonts();
      if (!alive) return;
      renderer.load(ui);
      setResources({layout: new ChatSourceLayout(ui, 'game_main_chat_shrinked.xml'),
        channels: new ChatSourceLayout(ui, 'game_main_channellist.xml'), emotes: new ChatSourceLayout(ui, 'game_main_emotelist.xml')});
    })().catch(error => {if (alive) chat.setStatus(String(error));});
    return () => {alive = false; abort.abort(); renderer.clear();};
  }, [chat, renderer]);
  useLayoutEffect(() => {renderer.setSourceLayout(source, log.current!);}, [source, renderer]);
  useEffect(() => {
    const resize = () => setSize({width: innerWidth, height: innerHeight});
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || composing.current || event.keyCode === 229
        || document.querySelector('dialog:modal') || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof HTMLElement && (event.target.closest('input, select, button, textarea, [role="scrollbar"]') || event.target.isContentEditable)) return;
      if (QUICK_CHAT_KEYS.includes(event.code as QuickChatKey)) {
        event.preventDefault(); if (!event.repeat) chat.sendQuickChat(event.code as QuickChatKey);
      } else if (event.code === 'Enter' && !event.repeat) {
        event.preventDefault(); chat.releaseInputKeys(); input.current?.focus();
      }
    };
    window.addEventListener('keydown', keydown); window.addEventListener('resize', resize);
    return () => {window.removeEventListener('keydown', keydown); window.removeEventListener('resize', resize);};
  }, [chat]);
  useLayoutEffect(() => {
    if (caret.current !== undefined && input.current) {
      input.current.setSelectionRange(caret.current, caret.current); caret.current = undefined;
    }
  }, [state.draft]);
  useLayoutEffect(() => {if (!active && log.current) log.current.scrollTop = log.current.scrollHeight;}, [state.messages, active]);
  const changeDraft = (text: string, position: number, normalize: boolean) => {
    const next = normalize ? normalizeEmoteInput(text) : text;
    if (next !== text) caret.current = normalizeEmoteInput(text.slice(0, position)).length;
    chat.setDraft(next);
  };
  const scale = Math.min(size.width / 800, size.height / 600);
  const waitingLayout = waiting && resources ? new HomeSourceLayout(resources.layout.ui, 'chat.xml') : undefined;
  const waitingPosition = (name: string) => waitingLayout && resources
    ? sourceProps(resources.layout.ui, waitingLayout, 'chat.xml', name, undefined, 0, -402) : undefined;
  const position = waiting ? waitingPosition(state.channel === 2 ? 'edtIntimateChatInput' : 'edtNormalUserInput')
    : resources?.layout.place(state.channel === 2 ? 'edtIntimateChatInput' : 'edtChat', 0, -435);
  const targetPosition = waiting ? waitingPosition('edtIntimateNameInput') : resources?.layout.place('edtIntimateNameInput', 0, -435);
  const logPosition = waiting ? waitingPosition('ChatTextBox') : resources?.layout.place('edtDisplayBox', 0, -435);
  const caretLayout = formal && source && resources
    ? waitingLayout ?? new HomeSourceLayout(resources.layout.ui, 'game_main_chat_shrinked.xml') : undefined;
  const latest = state.messages.at(-1)?.id ?? 0;
  const presentation = {
    channel: state.channel, pending: state.pending, composing, input,
    players: state.players, selectedName: state.targetName, chooseTarget: (name: string) => {
      const at = input.current?.selectionStart ?? state.draft.length;
      chat.releaseInputKeys(); chat.setTargetName(name); caret.current = at;
      requestAnimationFrame(() => {input.current?.focus(); input.current?.setSelectionRange(at, at);});
    },
    changeChannel: (value: 0 | 1 | 2 | 3) => {chat.releaseInputKeys(); chat.setChannel(value);},
    releaseKeys: () => chat.releaseInputKeys(), insert: (glyph: string, at: number) => {
      if (state.draft.length >= 72) {chat.setStatus('输入已达72字符上限'); return;}
      const next = state.draft.slice(0, at) + glyph + state.draft.slice(at);
      caret.current = at + glyph.length; chat.setDraft(next); input.current?.focus();
    },
  };
  const content = <>
      <ol ref={log} id="battle-chat-history" data-chat-log="" role="log" aria-label="房间消息"
        className={source ? 'source-chat-scroll-log' : undefined} {...logPosition}>
        {state.messages.map(message => <ChatMessage key={message.id} renderer={renderer} text={message.text} active={source} />)}
      </ol>
      <form onSubmit={event => {event.preventDefault(); if (!composing.current) chat.sendDraft();}}>
        <select data-chat-channel="" aria-label="聊天频道" value={state.channel} disabled={state.pending}
          onFocus={() => chat.releaseInputKeys()} onChange={event => {chat.releaseInputKeys(); chat.setChannel(event.currentTarget.value === '3' ? 3 : event.currentTarget.value === '2' ? 2 : event.currentTarget.value === '1' ? 1 : 0);}}>
          <option value="0">房间</option><option value="1">队伍</option><option value="2">密语</option><option value="3">好友</option>
        </select>
        {state.channel === 2 && <input ref={targetInput} {...targetPosition} data-chat-whisper-target aria-label="密语对象昵称"
          value={state.targetName} disabled={state.pending} autoComplete="off"
          onChange={event => chat.setTargetName(event.currentTarget.value)} onFocus={() => chat.releaseInputKeys()}
          onCompositionStart={() => {composing.current = true;}}
          onCompositionEnd={() => {composing.current = false;}}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Enter' && (event.nativeEvent.isComposing || composing.current || event.keyCode === 229)) {
              event.preventDefault();
            }
          }} onKeyUp={event => event.stopPropagation()}/>}
        <input ref={input} {...position} data-chat-input="" aria-label={state.channel === 3 ? '好友聊天内容' : state.channel === 2 ? '密语内容' : state.channel ? '队伍聊天内容' : '房间聊天内容'}
          placeholder={state.channel === 3 ? '好友（Enter发送）' : state.channel === 2 ? '密语（Enter发送）' : state.channel ? '队伍聊天（Enter发送，Esc返回）' : '房间聊天（Enter发送，Esc返回）'}
          maxLength={72} autoComplete="off" value={state.draft} onFocus={() => chat.releaseInputKeys()}
          onCompositionStart={() => {composing.current = true;}}
          onCompositionEnd={event => {composing.current = false; changeDraft(event.currentTarget.value,
            event.currentTarget.selectionStart ?? event.currentTarget.value.length, true);}}
          onChange={event => changeDraft(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length, !composing.current)}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) {
              if (event.key === 'Enter') event.preventDefault(); return;
            }
            if (event.key === 'Escape') {event.preventDefault(); input.current?.blur(); document.querySelector<HTMLCanvasElement>('canvas')?.focus();}
          }} />
        {caretLayout && resources && <>
          <RoomChatSourceCaret input={input} ui={resources.layout.ui} layout={caretLayout} scale={scale}
            suffix={waiting ? 'chat.xml' : 'game_main_chat_shrinked.xml'} offsetY={waiting ? -402 : -435}
            name={state.channel === 2 ? 'edtIntimateChatInput' : waiting ? 'edtNormalUserInput' : 'edtChat'} value={state.draft} />
          {state.channel === 2 && <RoomChatSourceCaret input={targetInput} ui={resources.layout.ui} layout={caretLayout}
            scale={scale} suffix={waiting ? 'chat.xml' : 'game_main_chat_shrinked.xml'} offsetY={waiting ? -402 : -435}
            name="edtIntimateNameInput" value={state.targetName} />}
        </>}
        <button type="submit" disabled={state.pending}>发送</button>
      </form>
      <p role="status" data-waiting-chat-business-status={waiting || undefined}>{state.status}</p>
      {active && resources && <SourceChatScrollbar log={log} layout={resources.layout} messageVersion={latest}
        releaseKeys={() => chat.releaseInputKeys()} />}
      {waiting && resources && <WaitingChatHistoryScrollbar list={log} ui={resources.layout.ui}
        properties={new HomeSourceLayout(resources.layout.ui, 'chat.xml').control('ChatTextBox').properties} scale={scale} />}
  </>;
  return <section ref={root} className={`battle-chat${active ? ' source-battle-chat' : waiting ? ' source-waiting-chat' : ''}`} aria-label="房间聊天"
    style={source ? {left: (size.width - 800 * scale) / 2, top: (size.height - 600 * scale) / 2 + (waiting ? 402 : 435) * scale,
      width: (waiting ? 612 : 301) * scale, height: (waiting ? 198 : 164) * scale} : undefined}>
    {waiting && resources ? <WaitingChatSourceView ui={resources.layout.ui} scale={scale} {...presentation}>{content}</WaitingChatSourceView>
      : <SourceBattleChat resources={resources} active={active} {...presentation}>{content}</SourceBattleChat>}
  </section>;
}

/** The shared original rich-text renderer owns only this leaf's contents. */
function ChatMessage({renderer, text, active}: {renderer: ChatEmotes; text: string; active: boolean}) {
  const element = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    const leaf = element.current!;
    renderer.render(leaf, text); return () => renderer.remove(leaf);
  }, [renderer, text, active]);
  return <li ref={element} data-chat-text={text} />;
}
