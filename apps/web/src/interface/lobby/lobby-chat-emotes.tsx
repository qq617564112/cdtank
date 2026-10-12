import './lobby-chat-emotes.css';
import {useEffect, useRef, type RefObject} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {ChatEmoteButton} from '../resources/chat-emote-button';
import {sourceProps} from '../resources/source-ui-props';
import {emoteGlyph} from '../battle/chat-emote-text';
import {LOBBY_CHAT_INPUT_BOUNDS, LOBBY_CHAT_INPUT_FACE_RIGHT, LOBBY_MAIN_BOUNDS} from './lobby-source-geometry';

/** Original lobby emote controls consume the existing React draft and caret. */
export function LobbyChatEmotes({ui, open, pending, composing, input, toggle, close, insert}: {
  ui: HomeSourceUi; open: boolean; pending: boolean; composing: RefObject<boolean>;
  input: RefObject<HTMLInputElement | null>; toggle: () => void; close: () => void;
  insert: (glyph: string, caret: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const blockClick = useRef(false);
  const chat = new HomeSourceLayout(ui, 'chat.xml');
  const emotes = new HomeSourceLayout(ui, 'chat_emotelist.xml');
  const position = sourceProps(ui, chat, 'chat.xml', 'btnExpandEmotion');
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-lobby-emote-menu], [data-lobby-emote-toggle]')) close();
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('blur', close);
    return () => {window.removeEventListener('pointerdown', outside); window.removeEventListener('blur', close);};
  }, [close]);
  return <div ref={root} style={{display: 'contents'}}
    onPointerDownCapture={event => {
      if (event.target instanceof Element && event.target.closest('[data-lobby-emote-toggle]')) {
        blockClick.current = composing.current;
        if (blockClick.current) event.preventDefault();
      }
    }} onPointerCancelCapture={() => {blockClick.current = false;}}
    onClickCapture={event => {
      if (event.target instanceof Element && event.target.closest('[data-lobby-emote-toggle]')
          && (blockClick.current || composing.current)) {
        blockClick.current = false; event.preventDefault(); event.stopPropagation();
      }
    }}>
    <ChatEmoteButton {...position}
      style={{...position.style,
        left: (LOBBY_CHAT_INPUT_FACE_RIGHT + LOBBY_MAIN_BOUNDS.right - Number(position.style.width)) / 2,
        top: LOBBY_CHAT_INPUT_BOUNDS.top + (LOBBY_CHAT_INPUT_BOUNDS.height - Number(position.style.height)) / 2}}
      data-lobby-emote-toggle="" aria-label="插入表情" aria-haspopup="menu" aria-expanded={open}
      disabled={pending} onClick={() => {
        if (pending || composing.current) return;
        toggle(); requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('button')?.focus());
      }} />
    {open && <div ref={menu} className="lobby-emote-menu" data-lobby-emote-menu=""
      role="menu" aria-label="选择表情">
      {Array.from({length: 30}, (_, index) => index + 1).map(id => {
        const name = String(id).padStart(3, '0');
        return <button key={id} type="button" {...sourceProps(ui, emotes, 'chat_emotelist.xml', name,
          emotes.control(name).properties.Image, -397, -20)} role="menuitem" aria-label={`表情${name}`}
          data-lobby-emote-choice={id} disabled={pending} onClick={() => {
            if (!pending && !composing.current && input.current) insert(emoteGlyph(id),
              input.current.selectionStart ?? input.current.value.length);
          }} />;
      })}
    </div>}
  </div>;
}
