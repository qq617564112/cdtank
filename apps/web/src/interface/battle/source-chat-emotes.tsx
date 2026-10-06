import {useRef, type RefObject} from 'react';
import {emoteGlyph} from './chat-emote-text';
import type {ChatSourceLayout} from './source-chat-layout';
import {HomeSourceLayout} from '../resources/source-ui-layout';
import {SourceButton} from '../resources/source-button';
import {SourceStaticImage} from '../resources/source-static-image';
import {sourceProps} from '../resources/source-ui-props';

export function SourceChatEmotes({layout, menuLayout, open, pending, composing, input, toggle, close, insert, releaseKeys}: {
  layout: ChatSourceLayout; menuLayout: ChatSourceLayout; open: boolean; pending: boolean;
  composing: RefObject<boolean>; input: RefObject<HTMLInputElement | null>;
  toggle: () => void; close: () => void; insert: (glyph: string, caret: number) => void; releaseKeys: () => void;
}) {
  const blockClick = useRef(false);
  const consumer = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const source = new HomeSourceLayout(layout.ui, 'game_main_chat_shrinked.xml');
  const emotes = new HomeSourceLayout(menuLayout.ui, 'game_main_emotelist.xml');
  return <div ref={consumer} style={{display: 'contents'}}
    onPointerDownCapture={event => {
      if (event.target instanceof Element && event.target.closest('[data-source-control="btnExpandEmotion"]')) {
        blockClick.current = composing.current;
        if (blockClick.current) event.preventDefault();
      }
    }} onPointerCancelCapture={() => {blockClick.current = false;}}
    onClickCapture={event => {
      if (event.target instanceof Element && event.target.closest('[data-source-control="btnExpandEmotion"]')
        && (blockClick.current || composing.current)) {
        blockClick.current = false; event.preventDefault(); event.stopPropagation();
      }
    }}>
    <SourceButton ui={layout.ui} layout={source} suffix="game_main_chat_shrinked.xml" source="btnExpandEmotion" offsetY={-435}
      aria-label="插入表情" aria-haspopup="menu" aria-expanded={open} disabled={pending}
      onClick={() => {
        if (pending || composing.current) return;
        releaseKeys(); toggle();
        requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('button')?.focus());
      }} />
    <div ref={menu} className="source-chat-emotes" data-chat-emote-menu="" hidden={!open} role="menu"
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!composing.current && !event.nativeEvent.isComposing) {
            close(); consumer.current?.querySelector<HTMLButtonElement>('[data-source-control="btnExpandEmotion"]')?.focus();
          }
        }
      }} onKeyUp={event => event.stopPropagation()}>
      {['all', 'biaoqingfuhaokuang'].map(name => <SourceStaticImage key={name} ui={menuLayout.ui}
        layout={emotes} suffix="game_main_emotelist.xml" name={name} offsetX={-89} offsetY={7} aria-hidden="true" />)}
      {Array.from({length: 30}, (_, index) => index + 1).map(id => {
        const name = String(id).padStart(3, '0');
        return <button key={id} {...sourceProps(menuLayout.ui, emotes, 'game_main_emotelist.xml', name,
          emotes.control(name).properties.Image, -89, 7)}
          type="button" data-chat-emote-choice={id} aria-label={`表情${name}`} role="menuitem" disabled={pending}
          onClick={() => {if (!pending && !composing.current && input.current) {
            insert(emoteGlyph(id), input.current.selectionStart ?? input.current.value.length);
          }}} />;
      })}
    </div>
  </div>;
}
