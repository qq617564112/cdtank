import './lobby-chat-emotes.css';
import {useEffect, useRef, type RefObject} from 'react';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';
import {emoteGlyph} from '../battle/chat-emote-text';

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
    <SourceButton ui={ui} layout={chat} suffix="chat.xml" source="btnExpandEmotion"
      data-lobby-emote-toggle="" aria-label="插入表情" aria-haspopup="menu" aria-expanded={open}
      disabled={pending} onClick={() => {
        if (pending || composing.current) return;
        toggle(); requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('button')?.focus());
      }} />
    {open && <div ref={menu} className="lobby-emote-menu" data-lobby-emote-menu="" role="menu">
      {['all', 'biaoqingfuhaokuang'].map(name => <SourceStaticImage key={name} ui={ui} layout={emotes}
        suffix="chat_emotelist.xml" name={name} offsetX={-397} offsetY={-20} aria-hidden="true" />)}
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
